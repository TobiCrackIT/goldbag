import { Stack } from "expo-router";
import { useColors } from "../../src/theme/tokens";

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
