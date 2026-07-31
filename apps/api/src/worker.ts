// Worker entrypoint: BullMQ schedulers + processors (architecture §2).
// Runs alongside the api process from the same image.
import { Queue, Worker } from "bullmq";
import { pino } from "pino";
import { loadEnv } from "./config/env.js";
import { loggerOptions } from "./lib/logger.js";
import { createPrisma } from "./lib/db.js";
import { createBullConnection, createRedis } from "./lib/redis.js";
import { runPricePoll } from "./jobs/price-poll.js";
import { runCandleBuild } from "./jobs/candle-builder.js";
import { backfillMissingCandles } from "./jobs/candle-backfill.js";

const env = loadEnv();
const log = pino(loggerOptions(env));
const prisma = createPrisma();
const redis = createRedis(env.REDIS_URL);

const PRICE_POLL = "price-poll";
const pricePollQueue = new Queue(PRICE_POLL, { connection: createBullConnection(env.REDIS_URL) });
await pricePollQueue.upsertJobScheduler(
  "price-poll-schedule",
  { every: env.PRICE_POLL_INTERVAL_MS },
  { name: PRICE_POLL },
);

const pricePollWorker = new Worker(
  PRICE_POLL,
  async () => {
    const started = Date.now();
    const result = await runPricePoll(prisma, redis, env);
    log.info({ ...result, ms: Date.now() - started }, "price poll cycle");
  },
  { connection: createBullConnection(env.REDIS_URL) },
);
pricePollWorker.on("failed", (_job, err) => log.error({ err }, "price poll failed"));

const CANDLE_BUILD = "candle-build";
const candleQueue = new Queue(CANDLE_BUILD, { connection: createBullConnection(env.REDIS_URL) });
await candleQueue.upsertJobScheduler(
  "candle-build-schedule",
  { every: 60_000 },
  { name: CANDLE_BUILD },
);

const candleWorker = new Worker(
  CANDLE_BUILD,
  async () => {
    // Backfill first: it targets assets with zero candles (new listings),
    // so it must run before the builder writes the current bucket.
    const backfill = await backfillMissingCandles(prisma, env.GECKOTERMINAL_BASE_URL);
    const built = await runCandleBuild(prisma, redis);
    log.info({ ...built, ...backfill }, "candle cycle");
  },
  { connection: createBullConnection(env.REDIS_URL) },
);
candleWorker.on("failed", (_job, err) => log.error({ err }, "candle build failed"));

log.info(
  { intervalMs: env.PRICE_POLL_INTERVAL_MS, jupiter: env.JUPITER_BASE_URL },
  "worker started",
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    log.info({ signal }, "worker shutting down");
    await pricePollWorker.close();
    await pricePollQueue.close();
    await candleWorker.close();
    await candleQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}
