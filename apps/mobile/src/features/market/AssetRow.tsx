import { Text, View } from "react-native";
import type { PublicAsset, PriceTick } from "@goldbag/shared";
import { formatUsd, formatPercentChange } from "../../lib/format";

/**
 * One asset row. Direction is carried by the sign and the arrow glyph,
 * never by colour — the design system is monochrome (PRD 7.6).
 */
export function AssetRow({ asset, tick }: { asset: PublicAsset; tick?: PriceTick }) {
  const change = tick?.change24hPct ?? null;

  return (
    <View className="flex-row items-center py-4 border-b border-border">
      <View className="h-10 w-10 rounded-full bg-elevated items-center justify-center">
        <Text className="text-primary text-xs font-semibold">{asset.symbol.slice(0, 2)}</Text>
      </View>

      <View className="flex-1 ml-3">
        <Text className="text-primary text-base font-medium">{asset.symbol}</Text>
        <Text className="text-secondary text-sm mt-0.5" numberOfLines={1}>
          {asset.name}
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-primary text-base font-medium tabular-nums">
          {tick ? formatUsd(tick.priceUsd) : "—"}
        </Text>
        {change !== null ? (
          <Text
            className={`text-sm mt-0.5 tabular-nums ${change < 0 ? "text-secondary" : "text-primary"}`}
          >
            {formatPercentChange(change)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
