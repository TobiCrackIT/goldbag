import fp from "fastify-plugin";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  Candle,
  CandlesQuery,
  ErrorResponseSchema,
  PriceTick,
  apiResponse,
  err,
  ok,
} from "@goldbag/shared";
import { priceKey } from "../../lib/cache.js";
import { toPrismaInterval } from "../../lib/candle-intervals.js";

export interface MarketPluginOptions {
  prisma: PrismaClient;
  redis?: Redis;
}

const PricesQuery = z.object({
  ids: z
    .string()
    .min(1)
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string()).min(1).max(100)),
});

export const marketPlugin = fp<MarketPluginOptions>(
  async (rawApp, { prisma, redis }) => {
    const app = rawApp.withTypeProvider<ZodTypeProvider>();

    // Batch latest prices: Redis cache first, asset_stats fallback.
    app.get(
      "/market/prices",
      { schema: { querystring: PricesQuery, response: { 200: apiResponse(z.array(PriceTick)) } } },
      async (req) => {
        const ids = req.query.ids;
        const ticks = new Map<string, PriceTick>();

        if (redis) {
          const cached = await redis.mget(ids.map(priceKey));
          cached.forEach((raw) => {
            if (raw) {
              const tick = JSON.parse(raw) as PriceTick;
              ticks.set(tick.assetId, tick);
            }
          });
        }

        const misses = ids.filter((id) => !ticks.has(id));
        if (misses.length > 0) {
          const stats = await prisma.assetStats.findMany({ where: { assetId: { in: misses } } });
          for (const s of stats) {
            ticks.set(s.assetId, {
              assetId: s.assetId,
              priceUsd: s.priceUsd.toString(),
              change24hPct: Number(s.change24hPct),
              underlyingPriceUsd: s.underlyingPriceUsd?.toString() ?? null,
              updatedAt: s.updatedAt.toISOString(),
            });
          }
        }
        return ok(ids.flatMap((id) => (ticks.has(id) ? [ticks.get(id)!] : [])));
      },
    );

    app.get(
      "/market/:assetId/candles",
      {
        schema: {
          params: z.object({ assetId: z.string() }),
          querystring: CandlesQuery,
          response: { 200: apiResponse(z.array(Candle)), 404: ErrorResponseSchema },
        },
      },
      async (req, reply) => {
        const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } });
        if (!asset || asset.status !== "listed") {
          return reply.code(404).send(err("NOT_FOUND", "No such asset"));
        }
        const rows = await prisma.candle.findMany({
          where: { assetId: asset.id, interval: toPrismaInterval(req.query.interval) },
          orderBy: { ts: "desc" },
          take: req.query.limit,
        });
        return ok(
          rows.reverse().map((r) => ({
            ts: r.ts.toISOString(),
            o: r.o.toString(),
            h: r.h.toString(),
            l: r.l.toString(),
            c: r.c.toString(),
            volume: r.volume?.toString() ?? null,
          })),
        );
      },
    );
  },
  { name: "market" },
);
