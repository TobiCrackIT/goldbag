import { z } from "zod";
import { AssetCategory, ChainId } from "./chain.js";

/**
 * Public shape of a listed asset — what the app renders in Markets.
 * Only `listed` assets ever leave the API, so status is not part of the
 * public contract; `listedAt` powers the "New" badge.
 */
export const PublicAsset = z.object({
  id: z.string(),
  chain: ChainId,
  tokenAddress: z.string(),
  symbol: z.string(),
  name: z.string(),
  category: AssetCategory,
  logoUrl: z.string().nullable(),
  decimals: z.number().int(),
  listedAt: z.iso.datetime().nullable(),
});
export type PublicAsset = z.infer<typeof PublicAsset>;

export const AssetsPage = z.object({
  items: z.array(PublicAsset),
  nextCursor: z.string().nullable(),
});
export type AssetsPage = z.infer<typeof AssetsPage>;

export const AssetsQuery = z.object({
  category: AssetCategory.optional(),
  search: z.string().min(1).max(64).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AssetsQuery = z.infer<typeof AssetsQuery>;
