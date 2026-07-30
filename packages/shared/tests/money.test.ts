import { describe, expect, it } from "vitest";
import { Bps, DecimalString, SignedDecimalString } from "../src/index.js";

describe("DecimalString", () => {
  it.each(["0", "1", "25", "0.5", "212.44", "0.000001", "1000000000000.000000001"])(
    "accepts %s",
    (value) => {
      expect(DecimalString.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "-1", // negative
    "1e5", // exponent
    "01.5", // leading zero
    ".5", // missing integer part
    "1.", // trailing dot
    "12,5", // wrong separator
    "NaN",
    "Infinity",
    "", // empty
    " 1", // whitespace
  ])("rejects %j", (value) => {
    expect(DecimalString.safeParse(value).success).toBe(false);
  });

  it("rejects non-strings (floats never touch money)", () => {
    expect(DecimalString.safeParse(212.44).success).toBe(false);
  });
});

describe("SignedDecimalString", () => {
  it("accepts negative values for P/L", () => {
    expect(SignedDecimalString.safeParse("-12.5").success).toBe(true);
    expect(SignedDecimalString.safeParse("0").success).toBe(true);
  });

  it("still rejects malformed values", () => {
    expect(SignedDecimalString.safeParse("--1").success).toBe(false);
    expect(SignedDecimalString.safeParse("-.5").success).toBe(false);
  });
});

describe("Bps", () => {
  it("accepts integers in [0, 10000]", () => {
    expect(Bps.safeParse(0).success).toBe(true);
    expect(Bps.safeParse(75).success).toBe(true);
    expect(Bps.safeParse(10_000).success).toBe(true);
  });

  it("rejects fractions, negatives, and out-of-range values", () => {
    expect(Bps.safeParse(0.5).success).toBe(false);
    expect(Bps.safeParse(-1).success).toBe(false);
    expect(Bps.safeParse(10_001).success).toBe(false);
  });
});
