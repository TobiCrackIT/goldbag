import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { PRICES_CHANNEL, USER_EVENTS_PATTERN } from "../../lib/cache.js";
import type { AuthProvider } from "../auth/provider.js";
import { upsertIdentity } from "../auth/service.js";

export interface WsPluginOptions {
  prisma: PrismaClient;
  provider: AuthProvider;
  /** Dedicated Redis connection in subscriber mode (fan-out across instances). */
  subscriber: Redis;
}

interface ClientState {
  userId: string;
  assetIds: Set<string>;
}

/**
 * WS /ws — auth via Bearer header or ?token= (mobile clients can't always
 * set headers on sockets). Channels: `prices` (subscribe by asset ids)
 * and the caller's own user events. Fan-out rides Redis pub/sub, so any
 * API instance serves any socket (architecture §4.5).
 */
export const wsPlugin = fp<WsPluginOptions>(
  async (app, { prisma, provider, subscriber }) => {
    await app.register(websocket);
    const clients = new Map<WebSocket, ClientState>();

    await subscriber.subscribe(PRICES_CHANNEL);
    await subscriber.psubscribe(USER_EVENTS_PATTERN);

    subscriber.on("message", (channel, raw) => {
      if (channel !== PRICES_CHANNEL) return;
      const tick = JSON.parse(raw) as { assetId: string };
      const payload = JSON.stringify({ type: "price", data: tick });
      for (const [socket, state] of clients) {
        if (state.assetIds.has(tick.assetId)) socket.send(payload);
      }
    });

    subscriber.on("pmessage", (_pattern, channel, raw) => {
      const userId = channel.split(":")[1];
      const payload = JSON.stringify({ type: "event", data: JSON.parse(raw) as unknown });
      for (const [socket, state] of clients) {
        if (state.userId === userId) socket.send(payload);
      }
    });

    app.get("/ws", { websocket: true }, (socket, req) => {
      const header = req.headers.authorization;
      const url = new URL(req.url, "http://localhost");
      const token = header?.startsWith("Bearer ")
        ? header.slice("Bearer ".length)
        : (url.searchParams.get("token") ?? "");

      // Listeners attach synchronously; frames arriving while auth is in
      // flight are buffered, not dropped.
      let state: ClientState | null = null;
      const pending: Buffer[] = [];

      const handleFrame = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type: string; assetIds?: string[] };
          if (!state || !Array.isArray(msg.assetIds)) return;
          const ids = state.assetIds;
          if (msg.type === "subscribe") msg.assetIds.forEach((id) => ids.add(id));
          if (msg.type === "unsubscribe") msg.assetIds.forEach((id) => ids.delete(id));
        } catch {
          // Malformed frames are ignored; the socket stays usable.
        }
      };

      socket.on("message", (raw: Buffer) => {
        if (state) handleFrame(raw);
        else pending.push(raw);
      });
      socket.on("close", () => clients.delete(socket));

      void (async () => {
        try {
          const identity = await provider.verifyAccessToken(token);
          const session = await upsertIdentity(prisma, provider.name, identity);
          state = { userId: session.userId, assetIds: new Set() };
          clients.set(socket, state);
          pending.splice(0).forEach(handleFrame);
        } catch {
          socket.close(4401, "unauthorized");
        }
      })();
    });

    app.addHook("onClose", async () => {
      await subscriber.unsubscribe(PRICES_CHANNEL).catch(() => {});
      await subscriber.punsubscribe(USER_EVENTS_PATTERN).catch(() => {});
    });
  },
  { name: "ws", dependencies: ["auth"] },
);
