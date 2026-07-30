import { z } from "zod";

/** Chain-agnostic core, Solana adapter first (architecture §1.3). */
export const ChainId = z.enum(["solana"]);
export type ChainId = z.infer<typeof ChainId>;

export const AssetCategory = z.enum(["stock", "etf", "gold_silver"]);
export type AssetCategory = z.infer<typeof AssetCategory>;

export const AssetStatus = z.enum(["listed", "paused", "delisted"]);
export type AssetStatus = z.infer<typeof AssetStatus>;

export const OrderSide = z.enum(["buy", "sell"]);
export type OrderSide = z.infer<typeof OrderSide>;

export const OrderStatus = z.enum([
  "quoted",
  "awaiting_signature",
  "submitted",
  "confirmed",
  "failed",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const DepositToken = z.enum(["usdc", "usdt"]);
export type DepositToken = z.infer<typeof DepositToken>;

export const CandleInterval = z.enum(["1m", "15m", "1h", "1d"]);
export type CandleInterval = z.infer<typeof CandleInterval>;
