import { describe, expect, it } from "vitest";
import { ErrorCode } from "@goldbag/shared";
import { getAssets, getCandles, getPrices } from "../src/lib/api/endpoints";
import { ApiError, NetworkError, errorCopy } from "../src/lib/api/errors";
import { request } from "../src/lib/api/client";
import { formatPercentChange, formatUsd } from "../src/lib/format";
import { z } from "zod";

const apiUrl = process.env.TEST_API_URL ?? "http://localhost:3000";
const live = await fetch(`${apiUrl}/health`)
  .then((r) => r.ok)
  .catch(() => false);

describe.skipIf(!live)("API client against the live API", () => {
  it("parses the assets page through the shared schema", async () => {
    const page = await getAssets({ limit: 10 });
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeGreaterThan(0);
    const asset = page.items[0]!;
    expect(asset).toMatchObject({ chain: "solana" });
    expect(typeof asset.symbol).toBe("string");
    expect(typeof asset.decimals).toBe("number");
  });

  it("parses batch prices", async () => {
    const page = await getAssets({ limit: 3 });
    const ticks = await getPrices(page.items.map((a) => a.id));
    expect(ticks.length).toBeGreaterThan(0);
    expect(Number(ticks[0]!.priceUsd)).toBeGreaterThan(0);
  });

  it("parses candles", async () => {
    const page = await getAssets({ limit: 1 });
    const candles = await getCandles(page.items[0]!.id, "1d", 5);
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[0]).toHaveProperty("o");
  });

  it("maps an API error envelope to a typed ApiError with friendly copy", async () => {
    const err = await getCandles("00000000-0000-0000-0000-000000000000", "1d").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("NOT_FOUND");
    // The user never sees the raw message.
    expect(errorCopy(err).message).toBe("We couldn't find what you were looking for.");
  });

  it("rejects a response that doesn't match the declared schema", async () => {
    // /assets returns a page object, not an array — the client must catch
    // the drift rather than hand back a malformed value.
    const err = await request("/assets", { schema: z.array(z.string()), anonymous: true }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("INTERNAL");
  });
});

describe("network failures are distinct from API errors", () => {
  it("throws NetworkError when the host is unreachable", async () => {
    const err = await request("/health", {
      schema: z.unknown(),
      anonymous: true,
      signal: AbortSignal.abort(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(errorCopy(err).title).toBe("No connection");
  });
});

describe("error copy covers the whole taxonomy", () => {
  it("every shared ErrorCode has non-placeholder copy", () => {
    for (const code of ErrorCode.options) {
      const copy = errorCopy(new ApiError(code, "raw internal detail"));
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.message.length).toBeGreaterThan(0);
      // Raw server text must never leak into user-facing copy.
      expect(copy.message).not.toContain("raw internal detail");
    }
  });

  it("unknown errors fall back rather than showing internals", () => {
    expect(errorCopy(new Error("boom at line 42")).message).toBe("Please try again in a moment.");
  });
});

describe("money formatting", () => {
  it("formats decimal strings without float drift", () => {
    expect(formatUsd("309.234769796308")).toBe("$309.23");
    expect(formatUsd("0.1")).toBe("$0.10");
    expect(formatUsd("nonsense")).toBe("—");
  });

  it("signals direction with sign and glyph, never colour", () => {
    expect(formatPercentChange(2.35)).toBe("▲ +2.35%");
    expect(formatPercentChange(-7.81)).toBe("▼ -7.81%");
    expect(formatPercentChange(0)).toBe("• +0.00%");
  });
});
