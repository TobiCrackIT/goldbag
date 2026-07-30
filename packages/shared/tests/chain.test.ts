import { describe, expect, it } from "vitest";
import {
  AssetCategory,
  AssetStatus,
  CandleInterval,
  ChainId,
  DepositToken,
  OrderSide,
  OrderStatus,
} from "../src/index.js";

describe("chain and asset enums", () => {
  it("solana is the only chain in MVP", () => {
    expect(ChainId.safeParse("solana").success).toBe(true);
    expect(ChainId.safeParse("ethereum").success).toBe(false);
  });

  it("asset categories match the PRD", () => {
    expect(AssetCategory.options).toEqual(["stock", "etf", "gold_silver"]);
    expect(AssetCategory.safeParse("real_estate").success).toBe(false);
  });

  it("asset and order lifecycle states parse", () => {
    expect(AssetStatus.safeParse("paused").success).toBe(true);
    expect(OrderStatus.safeParse("awaiting_signature").success).toBe(true);
    expect(OrderStatus.safeParse("cancelled").success).toBe(false);
    expect(OrderSide.safeParse("buy").success).toBe(true);
  });

  it("deposit tokens and candle intervals parse", () => {
    expect(DepositToken.safeParse("usdc").success).toBe(true);
    expect(DepositToken.safeParse("sol").success).toBe(false);
    expect(CandleInterval.safeParse("1d").success).toBe(true);
    expect(CandleInterval.safeParse("5m").success).toBe(false);
  });
});
