import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { PriceTick } from "@goldbag/shared";
import { priceKey } from "../lib/cache.js";
import { INTERVALS, bucketStart } from "../lib/candle-intervals.js";

/**
 * Build candles from our own tick stream (price-vendor decision): every
 * cycle samples the cached price and folds it into the current bucket of
 * each interval. Idempotent across restarts — state lives in the candles
 * table, not in memory.
 */
export async function runCandleBuild(prisma: PrismaClient, redis: Redis) {
  const assets = await prisma.asset.findMany({ where: { status: "listed" } });
  let folded = 0;

  for (const asset of assets) {
    const cached = await redis.get(priceKey(asset.id));
    if (!cached) continue; // no fresh tick — skip rather than fabricate
    const tick = JSON.parse(cached) as PriceTick;
    const price = tick.priceUsd;

    for (const { prisma: interval, ms } of INTERVALS) {
      const ts = bucketStart(ms);
      const existing = await prisma.candle.findUnique({
        where: { assetId_interval_ts: { assetId: asset.id, interval, ts } },
      });
      if (!existing) {
        await prisma.candle.create({
          data: { assetId: asset.id, interval, ts, o: price, h: price, l: price, c: price },
        });
      } else {
        await prisma.candle.update({
          where: { assetId_interval_ts: { assetId: asset.id, interval, ts } },
          data: {
            c: price,
            h: Number(price) > Number(existing.h) ? price : undefined,
            l: Number(price) < Number(existing.l) ? price : undefined,
          },
        });
      }
    }
    folded++;
  }
  return { folded, total: assets.length };
}
