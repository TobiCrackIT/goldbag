import "../src/lib/polyfills";
import "../src/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useColors } from "../src/theme/tokens";
import { queryClient, queryPersister } from "../src/lib/query-client";
import { AppLockGate } from "../src/features/auth/app-lock/AppLockGate";
import { PrivySessionProvider } from "../src/features/auth/providers/privy/PrivySessionProvider";
import { ApiTokenBridge } from "../src/features/auth/session/ApiTokenBridge";

// Route shell only: providers wrap here, screen logic lives in
// src/features/* (architecture §5.2).
export default function RootLayout() {
  const colors = useColors();

  return (
    <PrivySessionProvider>
      <ApiTokenBridge />
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <SafeAreaProvider>
        {/* `auto` flips the status bar contents with the device theme. */}
        <StatusBar style="auto" />
        <AppLockGate>
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
          </AppLockGate>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </PrivySessionProvider>
  );
}
