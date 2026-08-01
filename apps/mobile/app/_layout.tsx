import "../src/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColors } from "../src/theme/tokens";

// Route shell only: providers wrap here, screen logic lives in
// src/features/* (architecture §5.2).
export default function RootLayout() {
  const colors = useColors();

  return (
    <SafeAreaProvider>
      {/* `auto` flips the status bar contents with the device theme. */}
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </SafeAreaProvider>
  );
}
