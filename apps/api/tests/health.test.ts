import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp } from "../src/app.js";
import { createMockAuthProvider } from "./helpers/mock-auth.js";

const app = await buildApp(
  loadEnv({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@localhost:5432/test" }),
  { prisma: {} as PrismaClient, authProvider: createMockAuthProvider() },
);
afterAll(() => app.close());

describe("GET /health", () => {
  it("returns the ok envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { status: "ok" } });
  });
});

describe("env validation", () => {
  it("rejects an invalid PORT", () => {
    const exit = spyExit();
    loadEnv({ NODE_ENV: "test", PORT: "not-a-port" });
    expect(exit.called).toBe(true);
    exit.restore();
  });
});

// process.exit spy without pulling in a mocking library for one case
function spyExit() {
  const original = process.exit;
  const state = { called: false };
  // @ts-expect-error — intentional stub; never actually exits under test
  process.exit = () => {
    state.called = true;
  };
  return {
    get called() {
      return state.called;
    },
    restore() {
      process.exit = original;
    },
  };
}
