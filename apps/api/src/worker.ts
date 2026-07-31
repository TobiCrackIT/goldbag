// Worker entrypoint: BullMQ schedulers + processors (architecture §2).
// Runs alongside the api process from the same image.
import { Queue, Worker } from "bullmq";
import { pino } from "pino";
import { loadEnv } from "./config/env.js";
import { loggerOptions } from "./lib/logger.js";
import { createPrisma } from "./lib/db.js";
import { createBullConnection, createRedis } from "./lib/redis.js";
import { runPricePoll } from "./jobs/price-poll.js";

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

log.info(
  { intervalMs: env.PRICE_POLL_INTERVAL_MS, jupiter: env.JUPITER_BASE_URL },
  "worker started",
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    log.info({ signal }, "worker shutting down");
    await pricePollWorker.close();
    await pricePollQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}
