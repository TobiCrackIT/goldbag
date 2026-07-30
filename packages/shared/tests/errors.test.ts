import { describe, expect, it } from "vitest";
import { ApiErrorSchema, ErrorCode } from "../src/index.js";

describe("error taxonomy", () => {
  it("accepts every defined code", () => {
    for (const code of ErrorCode.options) {
      expect(ApiErrorSchema.safeParse({ code, message: "x" }).success).toBe(true);
    }
  });

  it("rejects unknown codes and malformed shapes", () => {
    expect(ErrorCode.safeParse("TOTALLY_NEW_ERROR").success).toBe(false);
    expect(ApiErrorSchema.safeParse({ code: "INTERNAL" }).success).toBe(false);
    expect(ApiErrorSchema.safeParse({ message: "no code" }).success).toBe(false);
  });

  it("covers the trade-critical codes from the PRD", () => {
    for (const code of [
      "QUOTE_EXPIRED",
      "SLIPPAGE_EXCEEDED",
      "INSUFFICIENT_BALANCE",
      "NETWORK_CONGESTION",
    ]) {
      expect(ErrorCode.safeParse(code).success).toBe(true);
    }
  });
});
