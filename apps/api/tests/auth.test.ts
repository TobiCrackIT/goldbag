import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp, type App } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";

const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
} as NodeJS.ProcessEnv;

const hasDb = Boolean(process.env.DATABASE_URL);
const opened: App[] = [];
afterAll(async () => {
  for (const app of opened) await app.close();
});

async function makeApp(prisma: PrismaClient, rateLimitMax = 1000) {
  const app = await buildApp(loadEnv(TEST_ENV), {
    prisma,
    authProvider: createMockAuthProvider(),
    rateLimit: { max: rateLimitMax, timeWindowMs: 60_000 },
  });
  opened.push(app);
  return app;
}

describe.skipIf(!hasDb)("auth: session flow through the seam (mock adapter)", () => {
  // Unique per run — a wallet address stays attached to the user that
  // first claimed it (append-only), mirroring one-wallet-per-user reality.
  const address = `TestAddr${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  it("valid token creates a user row + wallet and returns a session", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const app = await makeApp(prisma);
    const token = `mock:user-${Date.now()}:tobi@example.com:${address}`;

    const res = await app.inject({
      method: "POST",
      url: "/auth/session",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.walletAddress).toBe(address);
    expect(body.data.email).toBe("tobi@example.com");

    const row = await prisma.user.findUnique({
      where: { id: body.data.userId },
      include: { wallets: true },
    });
    expect(row?.authProvider).toBe("mock");
    expect(row?.wallets[0]?.address).toBe(address);

    // Same token again: same user, no duplicate rows (upsert-on-first-sight).
    const again = await app.inject({
      method: "POST",
      url: "/auth/session",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(again.json().data.userId).toBe(body.data.userId);
    await prisma.$disconnect();
  });

  it("forged token gets 401 with the error envelope", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const app = await makeApp(prisma);
    for (const bad of ["Bearer forged.jwt.token", "Bearer mock", "nonsense"]) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/session",
        headers: { authorization: bad },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHORIZED");
    }
    await prisma.$disconnect();
  });
});

describe("rate limiting", () => {
  it("hammering an endpoint returns 429 with RATE_LIMITED", async () => {
    const app = await makeApp({} as PrismaClient, 3);
    let last: number | undefined;
    let body: unknown;
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: "GET", url: "/health" });
      last = res.statusCode;
      body = res.json();
    }
    expect(last).toBe(429);
    expect((body as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });
});
