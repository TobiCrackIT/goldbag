import { z } from "zod";
import {
  AssetsPage,
  Candle,
  PriceTick,
  PublicAsset,
  type AssetCategory,
  type CandleInterval,
} from "@goldbag/shared";
import { request } from "./client";

/** One function per API route; schemas come from the shared contract. */

export function getAssets(params: {
  category?: AssetCategory;
  search?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request(`/assets${qs ? `?${qs}` : ""}`, {
    schema: AssetsPage,
    anonymous: true,
    signal: params.signal,
  });
}

export function getPrices(assetIds: string[], signal?: AbortSignal) {
  return request(`/market/prices?ids=${assetIds.join(",")}`, {
    schema: z.array(PriceTick),
    anonymous: true,
    signal,
  });
}

export function getCandles(
  assetId: string,
  interval: CandleInterval,
  limit?: number,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ interval });
  if (limit) qs.set("limit", String(limit));
  return request(`/market/${assetId}/candles?${qs.toString()}`, {
    schema: z.array(Candle),
    anonymous: true,
    signal,
  });
}

export function getWatchlist(signal?: AbortSignal) {
  return request("/watchlist", { schema: z.array(PublicAsset), signal });
}

export function addToWatchlist(assetId: string) {
  return request(`/watchlist/${assetId}`, {
    method: "POST",
    schema: z.object({ added: z.boolean() }),
  });
}

export function removeFromWatchlist(assetId: string) {
  return request(`/watchlist/${assetId}`, {
    method: "DELETE",
    schema: z.object({ removed: z.boolean() }),
  });
}

export function createSession() {
  return request("/auth/session", {
    method: "POST",
    schema: z.object({
      userId: z.string(),
      walletAddress: z.string().nullable(),
      email: z.string().nullable(),
    }),
  });
}
