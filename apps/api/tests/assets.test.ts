import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp, type App } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";

describe.skipIf(!hasDb)("asset registry (task 1.4 verify)", () => {
  let app: App;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}`;
  const mkAddress = (tag: string) => `Reg${tag}${suffix}`.padEnd(35, "x");

  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    app = await buildApp(
      loadEnv({ NODE_ENV: "test", DATABASE_URL: process.env.DATABASE_URL } as NodeJS.ProcessEnv),
      { prisma, authProvider: createMockAuthProvider(), adminToken: ADMIN_TOKEN },
    );
  });
  afterAll(async () => {
    await prisma.asset.deleteMany({ where: { symbol: { startsWith: "TST" } } });
    await app.close();
    await prisma.$disconnect();
  });

  const adminHeaders = { "x-admin-token": ADMIN_TOKEN };

  it("admin without/with wrong token gets 401", async () => {
    for (const headers of [{}, { "x-admin-token": "wrong-token-0123456789abcdef" }]) {
      const res = await app.inject({ method: "GET", url: "/admin/assets", headers });
      expect(res.statusCode).toBe(401);
    }
  });

  it("admin-created listed asset appears in the public list; paused does not", async () => {
    const listed = await app.inject({
      method: "POST",
      url: "/admin/assets",
      headers: adminHeaders,
      body: {
        tokenAddress: mkAddress("Listed"),
        symbol: "TSTLIST",
        name: "Test Listed Asset",
        category: "stock",
        decimals: 8,
        status: "listed",
      },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.listedAt).not.toBeNull();

    const paused = await app.inject({
      method: "POST",
      url: "/admin/assets",
      headers: adminHeaders,
      body: {
        tokenAddress: mkAddress("Paused"),
        symbol: "TSTPAUSE",
        name: "Test Paused Asset",
        category: "etf",
        decimals: 6,
        status: "paused",
      },
    });
    expect(paused.statusCode).toBe(200);

    const pub = await app.inject({ method: "GET", url: "/assets?limit=100&search=TST" });
    const symbols = pub.json().data.items.map((a: { symbol: string }) => a.symbol);
    expect(symbols).toContain("TSTLIST");
    expect(symbols).not.toContain("TSTPAUSE");
  });

  it("pausing a listed asset removes it from the public list", async () => {
    const pub = await app.inject({ method: "GET", url: "/assets?limit=100&search=TSTLIST" });
    const id = pub.json().data.items[0].id;

    const patch = await app.inject({
      method: "PATCH",
      url: `/admin/assets/${id}`,
      headers: adminHeaders,
      body: { status: "paused" },
    });
    expect(patch.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/assets?limit=100&search=TSTLIST" });
    expect(after.json().data.items).toHaveLength(0);
  });

  it("search matches by ticker and by name (seeded assets)", async () => {
    const byTicker = await app.inject({ method: "GET", url: "/assets?search=aapl" });
    expect(byTicker.json().data.items[0]?.symbol).toBe("AAPLx");

    const byName = await app.inject({ method: "GET", url: "/assets?search=tether" });
    expect(byName.json().data.items[0]?.symbol).toBe("XAUt0");
  });

  it("category filter and cursor pagination work", async () => {
    const gold = await app.inject({ method: "GET", url: "/assets?category=gold_silver&limit=100" });
    const symbols = gold.json().data.items.map((a: { symbol: string }) => a.symbol);
    expect(symbols).toContain("GLDx");
    expect(symbols).not.toContain("AAPLx");

    const page1 = await app.inject({ method: "GET", url: "/assets?limit=1" });
    const { items, nextCursor } = page1.json().data;
    expect(items).toHaveLength(1);
    expect(nextCursor).not.toBeNull();
    const page2 = await app.inject({ method: "GET", url: `/assets?limit=1&cursor=${nextCursor}` });
    expect(page2.json().data.items[0].id).not.toBe(items[0].id);
  });
});
