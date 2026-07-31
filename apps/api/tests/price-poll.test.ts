import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { loadEnv } from "../src/config/env.js";
import { PRICES_CHANNEL, priceKey } from "../src/lib/cache.js";

// Needs Postgres + Redis (local containers / CI services). Jupiter is
// mocked — this suite tests our pipeline, not the vendor.
const hasInfra = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasInfra)("price poller (task 1.5)", () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let subscriber: Redis;

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { createRedis } = await import("../src/lib/redis.js");
    prisma = new PrismaClient();
    redis = createRedis(process.env.REDIS_URL!);
    subscriber = createRedis(process.env.REDIS_URL!);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    subscriber.disconnect();
    vi.unstubAllGlobals();
  });

  it("one cycle updates asset_stats, caches with TTL, and publishes ticks", async () => {
    const assets = await prisma.asset.findMany({ where: { status: "listed" } });
    expect(assets.length).toBeGreaterThanOrEqual(3);

    const fakePrices = Object.fromEntries(
      assets.map((a, i) => [
        a.tokenAddress,
        {
          usdPrice: 100 + i,
          priceChange24h: -1.5,
          liquidity: 250_000,
          stockData: { price: 99 + i },
        },
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fakePrices), { status: 200 })),
    );

    const received: string[] = [];
    await subscriber.subscribe(PRICES_CHANNEL);
    subscriber.on("message", (_ch, msg) => received.push(msg));

    const { runPricePoll } = await import("../src/jobs/price-poll.js");
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
    } as NodeJS.ProcessEnv);
    const result = await runPricePoll(prisma, redis, env);
    expect(result.updated).toBe(assets.length);

    // asset_stats fresh
    const stats = await prisma.assetStats.findMany({
      where: { assetId: { in: assets.map((a) => a.id) } },
    });
    expect(stats).toHaveLength(assets.length);
    for (const s of stats) {
      expect(Date.now() - s.updatedAt.getTime()).toBeLessThan(10_000);
      expect(Number(s.priceUsd)).toBeGreaterThan(0);
      expect(s.underlyingPriceUsd).not.toBeNull();
    }

    // redis cache with TTL
    const first = assets[0]!;
    const cached = await redis.get(priceKey(first.id));
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!).priceUsd).toBe("100");
    const ttl = await redis.ttl(priceKey(first.id));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    // pub/sub fan-out
    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(assets.length));
    const tick = JSON.parse(received[0]!);
    expect(tick).toHaveProperty("assetId");
    expect(tick).toHaveProperty("priceUsd");
  });
});
