import { z } from "zod";

/**
 * The single error taxonomy for the whole product (architecture §6).
 * The API maps provider/chain errors into these codes; the app maps them to
 * user-facing copy. Adding a code here forces the copy discussion.
 */
export const ErrorCode = z.enum([
  // trade lifecycle
  "QUOTE_EXPIRED",
  "SLIPPAGE_EXCEEDED",
  "PRICE_IMPACT_TOO_HIGH",
  "INSUFFICIENT_BALANCE",
  "BLOCKHASH_EXPIRED",
  "NETWORK_CONGESTION",
  "ASSET_NOT_TRADABLE",
  // request handling
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  // catch-all: raw provider/chain errors never leave the API
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorSchema = z.object({
  code: ErrorCode,
  message: z.string().min(1),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
