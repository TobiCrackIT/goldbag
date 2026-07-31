import { Redis } from "ioredis";

/** Connection options per @fastify/rate-limit guidance for Redis stores. */
export function createRedis(url: string): Redis {
  return new Redis(url, {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
  });
}

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createBullConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}
