import { useEffect, useRef, type ReactNode } from "react";
import { AppState, type AppStateStatus, Pressable, Text, View } from "react-native";
import { useAppLockStore } from "./store";

/**
 * Top-level lock overlay (architecture §5.5) — mounted once in the root
 * layout, never per screen. Children stay mounted underneath so
 * unlocking restores the user exactly where they were.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const status = useAppLockStore((s) => s.status);
  const obscured = useAppLockStore((s) => s.obscured);
  const autoPrompted = useAppLockStore((s) => s.autoPrompted);
  const init = useAppLockStore((s) => s.init);
  const unlock = useAppLockStore((s) => s.unlock);
  const onBackground = useAppLockStore((s) => s.onBackground);
  const onForeground = useAppLockStore((s) => s.onForeground);
  const previous = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const wasActive = previous.current === "active";
      // 'inactive' fires for the app switcher and control centre on iOS —
      // cover then, not only on full background.
      if (wasActive && (next === "background" || next === "inactive")) onBackground();
      if (!wasActive && next === "active") onForeground();
      previous.current = next;
    });
    return () => sub.remove();
  }, [onBackground, onForeground]);

  // Prompt once per lock episode, without waiting for a tap. Guarded by
  // `autoPrompted` so a failed or dismissed prompt doesn't immediately
  // trigger another one — the user retries via the Unlock button.
  useEffect(() => {
    if (status === "locked" && !autoPrompted) void unlock();
  }, [status, autoPrompted, unlock]);

  const covered = status !== "unlocked" || obscured;

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-1" accessibilityElementsHidden={covered} importantForAccessibility={covered ? "no-hide-descendants" : "auto"}>
        {children}
      </View>

      {covered ? (
        <View className="absolute inset-0 bg-bg items-center justify-center px-8">
          {/* Obscured-only (app switcher): no copy, just an opaque cover. */}
          {status === "locked" ? (
            <>
              <Text className="text-primary text-2xl font-bold">Goldbag</Text>
              <Text className="text-secondary text-base text-center mt-3 leading-6">
                Locked for your security.
              </Text>
              <Pressable
                onPress={() => void unlock()}
                accessibilityRole="button"
                className="mt-8 rounded-full bg-accent px-8 py-4 active:opacity-70"
              >
                <Text className="text-on-accent text-base font-semibold">Unlock</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
