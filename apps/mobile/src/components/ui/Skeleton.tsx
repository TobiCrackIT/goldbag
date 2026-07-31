import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Placeholder block that pulses on the UI thread (Reanimated), so a
 * loading list never costs JS-thread frames — the 60fps bar in PRD 7.6.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={style} className={`bg-elevated rounded-xl ${className}`} />
  );
}

/** Skeleton shaped like an asset row, used by the markets list. */
export function AssetRowSkeleton() {
  return (
    <View className="flex-row items-center py-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 ml-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-36 mt-2" />
      </View>
      <Skeleton className="h-4 w-16" />
    </View>
  );
}
