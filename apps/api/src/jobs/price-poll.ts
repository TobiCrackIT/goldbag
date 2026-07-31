import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { PriceTick } from "@goldbag/shared";
import type { Env } from "../config/env.js";
import { PRICES_CHANNEL, PRICE_TTL_SECONDS, priceKey } from "../lib/cache.js";

interface JupiterPrice {
  usdPrice: number;
  priceChange24h?: number;
  liquidity?: number;
  stockData?: { price: number };
}

/** Decimal string without exponent notation (floats never travel as floats). */
const dec = (n: number) => n.toFixed(12).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function fetchJupiterPrices(
  baseUrl: string,
  mints: string[],
): Promise<Record<string, JupiterPrice>> {
  const out: Record<string, JupiterPrice> = {};
  // Batch limit is ~50 ids per request; 100 assets = 2 calls per cycle.
  for (const batch of chunk(mints, 50)) {
    const res = await fetch(`${baseUrl}/price/v3?ids=${batch.join(",")}`);
    if (!res.ok) throw new Error(`jupiter price api responded ${res.status}`);
    Object.assign(out, (await res.json()) as Record<string, JupiterPrice>);
  }
  return out;
}

/**
 * One poll cycle: fetch prices for every listed asset, upsert the hot
 * asset_stats row, refresh the Redis cache (TTL 60s), publish a tick on
 * the `prices` channel for WS fan-out.
 */
export async function runPricePoll(prisma: PrismaClient, redis: Redis, env: Env) {
  const assets = await prisma.asset.findMany({ where: { status: "listed" } });
  if (assets.length === 0) return { updated: 0, total: 0 };

  const prices = await fetchJupiterPrices(
    env.JUPITER_BASE_URL,
    assets.map((a) => a.tokenAddress),
  );

  let updated = 0;
  for (const asset of assets) {
    const p = prices[asset.tokenAddress];
    if (!p || typeof p.usdPrice !== "number") continue;

    const stats = {
      priceUsd: dec(p.usdPrice),
      change24hPct: dec(p.priceChange24h ?? 0),
      liquidityUsd: p.liquidity != null ? dec(p.liquidity) : null,
      underlyingPriceUsd: p.stockData?.price != null ? dec(p.stockData.price) : null,
    };
    await prisma.assetStats.upsert({
      where: { assetId: asset.id },
      create: { assetId: asset.id, ...stats },
      update: stats,
    });

    const tick: PriceTick = {
      assetId: asset.id,
      priceUsd: stats.priceUsd,
      change24hPct: p.priceChange24h ?? null,
      underlyingPriceUsd: stats.underlyingPriceUsd,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(priceKey(asset.id), JSON.stringify(tick), "EX", PRICE_TTL_SECONDS);
    await redis.publish(PRICES_CHANNEL, JSON.stringify(tick));
    updated++;
  }
  return { updated, total: assets.length };
}
