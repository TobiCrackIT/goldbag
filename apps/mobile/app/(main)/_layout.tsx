import { Tabs } from "expo-router";
import { useColors } from "../../src/theme/tokens";

export default function MainLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // Selection is signalled by contrast, not hue.
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="markets/index" options={{ title: "Markets" }} />
      <Tabs.Screen name="portfolio/index" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="account/index" options={{ title: "Account" }} />
    </Tabs>
  );
}
