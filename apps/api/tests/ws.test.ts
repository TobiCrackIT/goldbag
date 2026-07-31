import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { loadEnv } from "../src/config/env.js";
import { buildApp, type App } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";
import { PRICES_CHANNEL, userEventsChannel } from "../src/lib/cache.js";

const hasInfra = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasInfra)("WebSocket gateway (task 1.8 verify)", () => {
  let app: App;
  let prisma: PrismaClient;
  let redis: Redis;
  let subscriber: Redis;
  let port: number;
  let userId: string;
  const token = `mock:ws-user-${Date.now()}`;

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { createRedis } = await import("../src/lib/redis.js");
    prisma = new PrismaClient();
    redis = createRedis(process.env.REDIS_URL!);
    subscriber = createRedis(process.env.REDIS_URL!);
    app = await buildApp(
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
      } as NodeJS.ProcessEnv),
      { prisma, redis, redisSubscriber: subscriber, authProvider: createMockAuthProvider() },
    );
    await app.listen({ host: "127.0.0.1", port: 0 });
    port = (app.server.address() as AddressInfo).port;

    const session = await app.inject({
      method: "POST",
      url: "/auth/session",
      headers: { authorization: `Bearer ${token}` },
    });
    userId = session.json().data.userId;
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    subscriber.disconnect();
  });

  it("refuses an unauthenticated socket", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const code = await new Promise<number>((resolve) => {
      socket.addEventListener("close", (e) => resolve(e.code));
    });
    expect(code).toBe(4401);
  });

  it("authenticated socket receives subscribed price ticks", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    await new Promise((resolve) => socket.addEventListener("open", resolve));

    const messages: { type: string; data: { assetId?: string } }[] = [];
    socket.addEventListener("message", (e) => messages.push(JSON.parse(String(e.data))));

    socket.send(JSON.stringify({ type: "subscribe", assetIds: ["asset-a"] }));
    await new Promise((r) => setTimeout(r, 150));

    await redis.publish(
      PRICES_CHANNEL,
      JSON.stringify({ assetId: "asset-a", priceUsd: "123.45" }),
    );
    await redis.publish(
      PRICES_CHANNEL,
      JSON.stringify({ assetId: "asset-b", priceUsd: "999" }),
    );

    await vi.waitFor(() => expect(messages.length).toBeGreaterThanOrEqual(1));
    expect(messages[0]!.type).toBe("price");
    expect(messages[0]!.data.assetId).toBe("asset-a");
    // not subscribed to asset-b — must not arrive
    expect(messages.some((m) => m.data.assetId === "asset-b")).toBe(false);
    socket.close();
  });

  it("delivers user events to the right user only", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    await new Promise((resolve) => socket.addEventListener("open", resolve));
    const messages: { type: string; data: { kind?: string } }[] = [];
    socket.addEventListener("message", (e) => messages.push(JSON.parse(String(e.data))));
    await new Promise((r) => setTimeout(r, 150));

    await redis.publish(userEventsChannel("someone-else"), JSON.stringify({ kind: "other" }));
    await redis.publish(userEventsChannel(userId), JSON.stringify({ kind: "deposit_confirmed" }));

    await vi.waitFor(() => expect(messages.length).toBeGreaterThanOrEqual(1));
    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe("event");
    expect(messages[0]!.data.kind).toBe("deposit_confirmed");
    socket.close();
  });
});
