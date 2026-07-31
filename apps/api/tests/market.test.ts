import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { loadEnv } from "../src/config/env.js";
import { buildApp, type App } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";
import { priceKey } from "../src/lib/cache.js";

const hasInfra = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasInfra)("market endpoints + candle jobs (task 1.6)", () => {
  let app: App;
  let prisma: PrismaClient;
  let redis: Redis;
  let assetIds: string[] = [];

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { createRedis } = await import("../src/lib/redis.js");
    prisma = new PrismaClient();
    redis = createRedis(process.env.REDIS_URL!);
    app = await buildApp(
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
      } as NodeJS.ProcessEnv),
      { prisma, redis, authProvider: createMockAuthProvider() },
    );
    // Pin to the seed set — other suites create transient listed assets
    // in the same database.
    const assets = await prisma.asset.findMany({
      where: { status: "listed", symbol: { in: ["AAPLx", "GLDx", "XAUt0"] } },
    });
    assetIds = assets.map((a) => a.id);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    vi.unstubAllGlobals();
  });

  it("GET /market/prices serves cached ticks and falls back to asset_stats", async () => {
    // Redis-cached path (poller keeps these warm) or DB fallback — both
    // must produce the same shape.
    const res = await app.inject({
      method: "GET",
      url: `/market/prices?ids=${assetIds.join(",")}`,
    });
    expect(res.statusCode).toBe(200);
    const ticks = res.json().data;
    expect(ticks.length).toBe(assetIds.length);
    for (const t of ticks) {
      expect(Number(t.priceUsd)).toBeGreaterThan(0);
      expect(t).toHaveProperty("updatedAt");
    }

    // Force the DB-fallback path for one asset.
    await redis.del(priceKey(assetIds[0]!));
    const res2 = await app.inject({ method: "GET", url: `/market/prices?ids=${assetIds[0]}` });
    expect(res2.json().data).toHaveLength(1);
  });

  it("candle-builder folds ticks into all four intervals with correct o/h/l/c", async () => {
    const { runCandleBuild } = await import("../src/jobs/candle-builder.js");
    // Own asset — writing fake prices against seeded assets pollutes the
    // shared dev database and the real poller's candles.
    const own = await prisma.asset.create({
      data: {
        chain: "solana",
        tokenAddress: `BuilderTest${Date.now()}`.padEnd(35, "z"),
        symbol: "TSTCB",
        name: "Candle Builder Test Asset",
        category: "stock",
        decimals: 8,
        status: "listed",
        listedAt: new Date(),
      },
    });
    const target = own.id;

    const setPrice = (p: string) =>
      redis.set(
        priceKey(target),
        JSON.stringify({
          assetId: target,
          priceUsd: p,
          change24hPct: 0,
          underlyingPriceUsd: null,
          updatedAt: new Date().toISOString(),
        }),
      );

    await setPrice("100");
    await runCandleBuild(prisma, redis);
    await setPrice("110");
    await runCandleBuild(prisma, redis);
    await setPrice("95");
    await runCandleBuild(prisma, redis);

    for (const interval of ["m1", "m15", "h1", "d1"] as const) {
      const candles = await prisma.candle.findMany({
        where: { assetId: target, interval },
        orderBy: { ts: "desc" },
        take: 1,
      });
      expect(candles).toHaveLength(1);
      const c = candles[0]!;
      expect(Number(c.h)).toBeGreaterThanOrEqual(110);
      expect(Number(c.l)).toBeLessThanOrEqual(95);
      expect(Number(c.c)).toBe(95);
    }

    await redis.del(priceKey(target));
    await prisma.candle.deleteMany({ where: { assetId: target } });
    await prisma.asset.delete({ where: { id: target } });
  });

  it("backfill fills a new listed asset from mocked GeckoTerminal and candles endpoint serves them", async () => {
    const created = await prisma.asset.create({
      data: {
        chain: "solana",
        tokenAddress: `BackfillTest${Date.now()}`.padEnd(35, "y"),
        symbol: "TSTBF",
        name: "Backfill Test Asset",
        category: "stock",
        decimals: 8,
        status: "listed",
        listedAt: new Date(),
      },
    });

    const now = Math.floor(Date.now() / 1000);
    const ohlcv = (n: number) =>
      Array.from({ length: n }, (_, i) => [now - i * 60, 10, 12, 9, 11, 1000]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.includes("/pools?page=1")) {
          return new Response(
            JSON.stringify({
              data: [
                { id: "solana_POOLADDR", attributes: { name: "TSTBF / USDC", reserve_in_usd: "50000" } },
              ],
            }),
          );
        }
        return new Response(
          JSON.stringify({ data: { attributes: { ohlcv_list: ohlcv(50) } } }),
        );
      }),
    );

    const { backfillMissingCandles } = await import("../src/jobs/candle-backfill.js");
    // Scoped to the test's own asset — never touch the shared seed data.
    const result = await backfillMissingCandles(
      prisma,
      "https://api.geckoterminal.com/api/v2",
      0,
      [created.id],
    );
    expect(result.backfilled).toBeGreaterThanOrEqual(1);
    vi.unstubAllGlobals();

    for (const interval of ["1m", "15m", "1h", "1d"] as const) {
      const res = await app.inject({
        method: "GET",
        url: `/market/${created.id}/candles?interval=${interval}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    }

    // ascending order for charts
    const res = await app.inject({ method: "GET", url: `/market/${created.id}/candles?interval=1m` });
    const candles = res.json().data;
    expect(new Date(candles[0].ts).getTime()).toBeLessThan(
      new Date(candles[candles.length - 1].ts).getTime(),
    );

    await prisma.candle.deleteMany({ where: { assetId: created.id } });
    await prisma.asset.delete({ where: { id: created.id } });
  });

  it("candles for an unknown asset 404 with the envelope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/market/00000000-0000-0000-0000-000000000000/candles?interval=1d",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});
