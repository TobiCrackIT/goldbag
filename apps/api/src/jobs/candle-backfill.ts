import type { PrismaClient } from "@prisma/client";
import { INTERVALS } from "../lib/candle-intervals.js";

/**
 * One-time chart backfill for assets with no candles yet (new listings),
 * from GeckoTerminal pool OHLCV (price-vendor decision — backfill only,
 * never the hot path). Failure is non-fatal: charts fill from our own
 * ticks either way.
 */

type OhlcvRow = [number, number, number, number, number, number];

/** Raised on 429 — abort the whole cycle and retry next minute. */
export class RateLimitedError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free tier allows ~30 calls/min; 2.5s spacing keeps a full-cycle burst under it.
export const GT_CALL_SPACING_MS = 2500;

async function getJson(url: string, spacingMs: number): Promise<unknown> {
  await sleep(spacingMs);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 429) throw new RateLimitedError(`geckoterminal rate limited: ${url}`);
  if (!res.ok) throw new Error(`geckoterminal responded ${res.status} for ${url}`);
  return res.json();
}

async function topPoolAddress(
  baseUrl: string,
  tokenAddress: string,
  spacingMs: number,
): Promise<string | null> {
  const data = (await getJson(
    `${baseUrl}/networks/solana/tokens/${tokenAddress}/pools?page=1`,
    spacingMs,
  )) as { data?: { id: string; attributes: { reserve_in_usd: string } }[] };
  const pools = data.data ?? [];
  if (pools.length === 0) return null;
  const top = pools.reduce((a, b) =>
    Number(a.attributes.reserve_in_usd) >= Number(b.attributes.reserve_in_usd) ? a : b,
  );
  return top.id.replace("solana_", "");
}

const dec = (n: number) => n.toFixed(12).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

// GT timeframe per interval: (path, aggregate)
const GT_TIMEFRAME: Record<string, { path: string; aggregate: number }> = {
  m1: { path: "minute", aggregate: 1 },
  m15: { path: "minute", aggregate: 15 },
  h1: { path: "hour", aggregate: 1 },
  d1: { path: "day", aggregate: 1 },
};

export async function backfillMissingCandles(
  prisma: PrismaClient,
  baseUrl: string,
  spacingMs: number = GT_CALL_SPACING_MS,
  onlyAssetIds?: string[],
) {
  // Candidate = listed asset that has never completed a full backfill
  // pass. Explicit state (candles_backfilled_at) survives partial passes,
  // sampler writes, and restarts.
  const missing = await prisma.asset.findMany({
    where: {
      status: "listed",
      candlesBackfilledAt: null,
      ...(onlyAssetIds ? { id: { in: onlyAssetIds } } : {}),
    },
  });
  let backfilled = 0;

  for (const asset of missing) {
    try {
      const pool = await topPoolAddress(baseUrl, asset.tokenAddress, spacingMs);
      if (!pool) {
        // No DEX pool indexed — nothing to backfill; charts fill from our
        // own ticks. Mark done so we don't ask the vendor forever.
        await prisma.asset.update({
          where: { id: asset.id },
          data: { candlesBackfilledAt: new Date() },
        });
        continue;
      }

      for (const { prisma: interval } of INTERVALS) {
        const tf = GT_TIMEFRAME[interval]!;
        const data = (await getJson(
          `${baseUrl}/networks/solana/pools/${pool}/ohlcv/${tf.path}?aggregate=${tf.aggregate}&limit=1000`,
          spacingMs,
        )) as { data?: { attributes?: { ohlcv_list?: OhlcvRow[] } } };
        const rows = data.data?.attributes?.ohlcv_list ?? [];
        if (rows.length === 0) continue;

        await prisma.candle.createMany({
          data: rows.map(([ts, o, h, l, c, v]) => ({
            assetId: asset.id,
            interval,
            ts: new Date(ts * 1000),
            o: dec(o),
            h: dec(h),
            l: dec(l),
            c: dec(c),
            volume: dec(v),
          })),
          skipDuplicates: true,
        });
      }
      // Every interval fetched without error — this asset is done.
      await prisma.asset.update({
        where: { id: asset.id },
        data: { candlesBackfilledAt: new Date() },
      });
      backfilled++;
    } catch (e) {
      if (e instanceof RateLimitedError) {
        // Vendor is throttling us — stop the cycle, retry next schedule.
        console.error(`backfill rate-limited at ${asset.symbol}; deferring rest of cycle`);
        break;
      }
      // One asset failing to backfill must not block the others.
      console.error(`backfill failed for ${asset.symbol}:`, e);
    }
  }
  return { backfilled, candidates: missing.length };
}
