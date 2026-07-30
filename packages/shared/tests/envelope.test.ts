import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiResponse, err, isErr, ok } from "../src/index.js";

const PriceResponse = apiResponse(z.object({ priceUsd: z.string() }));

describe("response envelope", () => {
  it("accepts a data payload matching the schema", () => {
    const parsed = PriceResponse.safeParse(ok({ priceUsd: "212.44" }));
    expect(parsed.success).toBe(true);
  });

  it("accepts an error payload with a known code", () => {
    const parsed = PriceResponse.safeParse(err("QUOTE_EXPIRED", "Quote expired, re-quoting"));
    expect(parsed.success).toBe(true);
  });

  it("rejects an error payload with an unknown code", () => {
    const parsed = PriceResponse.safeParse({
      error: { code: "SOMETHING_ELSE", message: "nope" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a payload that is neither data nor error", () => {
    expect(PriceResponse.safeParse({ result: 42 }).success).toBe(false);
    expect(PriceResponse.safeParse({ data: { priceUsd: 212.44 } }).success).toBe(false);
  });

  it("rejects an error with an empty message", () => {
    expect(PriceResponse.safeParse({ error: { code: "INTERNAL", message: "" } }).success).toBe(
      false,
    );
  });

  it("isErr narrows the union", () => {
    const good = ok({ priceUsd: "1" });
    const bad = err("INTERNAL", "boom");
    expect(isErr(good)).toBe(false);
    expect(isErr(bad)).toBe(true);
    if (isErr(bad)) {
      expect(bad.error.code).toBe("INTERNAL");
    }
  });
});
