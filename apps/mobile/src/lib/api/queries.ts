import { useQuery } from "@tanstack/react-query";
import type { AssetCategory, CandleInterval } from "@goldbag/shared";
import { getAssets, getCandles, getPrices } from "./endpoints.js";

/** Query keys in one place so cache writes (WS ticks) can target them. */
export const queryKeys = {
  assets: (category?: AssetCategory, search?: string) =>
    ["assets", category ?? "all", search ?? ""] as const,
  prices: (assetIds: string[]) => ["prices", [...assetIds].sort().join(",")] as const,
  price: (assetId: string) => ["price", assetId] as const,
  candles: (assetId: string, interval: CandleInterval) =>
    ["candles", assetId, interval] as const,
  watchlist: () => ["watchlist"] as const,
};

export function useAssets(params: { category?: AssetCategory; search?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.assets(params.category, params.search),
    queryFn: ({ signal }) => getAssets({ ...params, signal }),
  });
}

export function usePrices(assetIds: string[]) {
  return useQuery({
    queryKey: queryKeys.prices(assetIds),
    queryFn: ({ signal }) => getPrices(assetIds, signal),
    enabled: assetIds.length > 0,
    // The WS gateway pushes updates; this is the fallback cadence.
    refetchInterval: 30_000,
  });
}

export function useCandles(assetId: string, interval: CandleInterval) {
  return useQuery({
    queryKey: queryKeys.candles(assetId, interval),
    queryFn: ({ signal }) => getCandles(assetId, interval, undefined, signal),
    enabled: Boolean(assetId),
  });
}
