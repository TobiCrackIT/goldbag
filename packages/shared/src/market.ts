import { z } from "zod";

/**
 * One price update for one asset — the same shape whether it arrives via
 * REST (GET /market/prices) or the WebSocket `prices` channel, so the app
 * has a single update path into its query cache (architecture §5.3).
 */
export const PriceTick = z.object({
  assetId: z.string(),
  priceUsd: z.string(),
  change24hPct: z.number().nullable(),
  /** Official underlying equity/metal reference price, when the vendor provides one. */
  underlyingPriceUsd: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type PriceTick = z.infer<typeof PriceTick>;
