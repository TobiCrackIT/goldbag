import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAssets, usePrices } from "../../../src/lib/api/queries";
import { QueryBoundary, EmptyState } from "../../../src/components/ui/QueryBoundary";
import { AssetRowSkeleton } from "../../../src/components/ui/Skeleton";
import { AssetRow } from "../../../src/features/market/AssetRow";

export default function Markets() {
  const assetsQuery = useAssets();
  const assetIds = useMemo(
    () => assetsQuery.data?.items.map((a) => a.id) ?? [],
    [assetsQuery.data],
  );
  const pricesQuery = usePrices(assetIds);

  const tickByAsset = useMemo(
    () => new Map((pricesQuery.data ?? []).map((t) => [t.assetId, t])),
    [pricesQuery.data],
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-6 pt-2 pb-1">
        <Text className="text-primary text-3xl font-bold">Markets</Text>
      </View>

      <QueryBoundary
        query={assetsQuery}
        loading={
          <View className="px-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <AssetRowSkeleton key={i} />
            ))}
          </View>
        }
        isEmpty={(page) => page.items.length === 0}
        empty={
          <EmptyState
            title="No assets yet"
            message="Listings appear here as soon as they go live."
          />
        }
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(a) => a.id}
            // QueryBoundary returns this without a wrapper, so the list
            // must claim its own height — without flex-1 it measures to
            // zero inside the flex column and renders nothing.
            className="flex-1"
            contentContainerClassName="px-6 pb-8"
            renderItem={({ item }) => <AssetRow asset={item} tick={tickByAsset.get(item.id)} />}
            refreshing={assetsQuery.isFetching}
            onRefresh={() => void assetsQuery.refetch()}
          />
        )}
      </QueryBoundary>
    </SafeAreaView>
  );
}
