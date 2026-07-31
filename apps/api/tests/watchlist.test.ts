import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp, type App } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("watchlist (task 1.7 verify)", () => {
  let app: App;
  let prisma: PrismaClient;
  let userId: string;
  let assetId: string;
  const token = `mock:watchlist-user-${Date.now()}`;
  const auth = { authorization: `Bearer ${token}` };

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    app = await buildApp(
      loadEnv({ NODE_ENV: "test", DATABASE_URL: process.env.DATABASE_URL } as NodeJS.ProcessEnv),
      { prisma, authProvider: createMockAuthProvider() },
    );
    const session = await app.inject({ method: "POST", url: "/auth/session", headers: auth });
    userId = session.json().data.userId;
    const asset = await prisma.asset.findFirstOrThrow({ where: { symbol: "AAPLx" } });
    assetId = asset.id;
  });
  afterAll(async () => {
    await prisma.watchlistItem.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
    await prisma.$disconnect();
  });

  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/watchlist" });
    expect(res.statusCode).toBe(401);
  });

  it("add → list → delete round-trip", async () => {
    const add = await app.inject({ method: "POST", url: `/watchlist/${assetId}`, headers: auth });
    expect(add.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/watchlist", headers: auth });
    expect(list.json().data.map((a: { symbol: string }) => a.symbol)).toContain("AAPLx");

    const del = await app.inject({ method: "DELETE", url: `/watchlist/${assetId}`, headers: auth });
    expect(del.json().data.removed).toBe(true);

    const after = await app.inject({ method: "GET", url: "/watchlist", headers: auth });
    expect(after.json().data).toHaveLength(0);
  });

  it("double-add is a no-op, not an error; absent delete is a no-op", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await app.inject({ method: "POST", url: `/watchlist/${assetId}`, headers: auth });
      expect(res.statusCode).toBe(200);
    }
    const rows = await prisma.watchlistItem.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);

    await app.inject({ method: "DELETE", url: `/watchlist/${assetId}`, headers: auth });
    const again = await app.inject({ method: "DELETE", url: `/watchlist/${assetId}`, headers: auth });
    expect(again.statusCode).toBe(200);
    expect(again.json().data.removed).toBe(false);
  });

  it("watching an unknown asset 404s", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/watchlist/00000000-0000-0000-0000-000000000000",
      headers: auth,
    });
    expect(res.statusCode).toBe(404);
  });
});
