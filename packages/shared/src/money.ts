import { z } from "zod";

/**
 * Money and quantities travel as decimal strings end to end — DECIMAL in
 * Postgres, decimal.js in the API, BigInt base units only inside chain
 * adapters (architecture §6, "JS floats never touch money"). The branded
 * types make it a compile error to pass an unvalidated string where an
 * amount is expected.
 */

/** Non-negative decimal, no leading zeros, no exponent: "0", "12.5", "0.000001". */
const DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

/** Optionally signed decimal, for P/L and 24h-change style values. */
const SIGNED_DECIMAL_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

export const DecimalString = z
  .string()
  .regex(DECIMAL_RE, "expected a non-negative decimal string")
  .brand<"DecimalString">();
export type DecimalString = z.infer<typeof DecimalString>;

export const SignedDecimalString = z
  .string()
  .regex(SIGNED_DECIMAL_RE, "expected a decimal string")
  .brand<"SignedDecimalString">();
export type SignedDecimalString = z.infer<typeof SignedDecimalString>;

/** Basis points as an integer (platform fee, price impact, slippage bound). */
export const Bps = z.number().int().min(0).max(10_000).brand<"Bps">();
export type Bps = z.infer<typeof Bps>;
