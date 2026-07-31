import { describe, expect, it } from "vitest";

// DB smoke test — runs only when a database is configured (local dev, CI
// with a Postgres service). Skipped otherwise so `turbo test` stays green
// on machines without infrastructure.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("database smoke", () => {
  it("returns the seeded assets with correct fields", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const assets = await prisma.asset.findMany({
        where: { status: "listed" },
        include: { stats: true },
        orderBy: { symbol: "asc" },
      });
      expect(assets.length).toBeGreaterThanOrEqual(3);
      const symbols = assets.map((a) => a.symbol);
      expect(symbols).toEqual(expect.arrayContaining(["AAPLx", "GLDx", "XAUt0"]));
      for (const a of assets) {
        expect(a.chain).toBe("solana");
        expect(a.decimals).toBeGreaterThan(0);
        expect(["stock", "etf", "gold_silver"]).toContain(a.category);
      }
    } finally {
      await prisma.$disconnect();
    }
  });
});
