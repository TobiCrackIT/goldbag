import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useAppLockStore } from "./store";
import { getBiometricCapability } from "./biometrics";
import { formatUsd } from "../../../lib/format";

const TIMEOUTS = [0, 1, 5, 15] as const;

const timeoutLabel = (m: number) => (m === 0 ? "Immediately" : m === 1 ? "1 min" : `${m} mins`);

/** Settings block for the Account tab — the only way to change the gate. */
export function AppLockSettings() {
  const prefs = useAppLockStore((s) => s.prefs);
  const setPrefs = useAppLockStore((s) => s.setPrefs);
  const requireFreshAuth = useAppLockStore((s) => s.requireFreshAuth);
  const [method, setMethod] = useState("Biometrics");

  useEffect(() => {
    void getBiometricCapability().then((c) => setMethod(c.label));
  }, []);

  // Turning the lock OFF is itself a sensitive action — prove it's the owner.
  const toggle = async (next: boolean) => {
    if (!next && !(await requireFreshAuth("Turn off app lock"))) return;
    await setPrefs({ enabled: next });
  };

  return (
    <View className="mt-8">
      <Text className="text-secondary text-xs uppercase tracking-wide">Security</Text>

      <View className="mt-3 rounded-2xl border border-border bg-surface">
        <View className="flex-row items-center justify-between px-4 py-4">
          <View className="flex-1 pr-4">
            <Text className="text-primary text-base font-medium">App lock</Text>
            <Text className="text-secondary text-sm mt-0.5">
              Require {method} to open Goldbag
            </Text>
          </View>
          <Switch value={prefs.enabled} onValueChange={(v) => void toggle(v)} />
        </View>

        {prefs.enabled ? (
          <>
            <View className="h-px bg-border" />
            <View className="px-4 py-4">
              <Text className="text-primary text-base font-medium">Lock after</Text>
              <View className="flex-row mt-3 gap-2">
                {TIMEOUTS.map((m) => {
                  const active = prefs.timeoutMinutes === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => void setPrefs({ timeoutMinutes: m })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`rounded-full px-4 py-2 border ${
                        active ? "bg-accent border-accent" : "border-border"
                      }`}
                    >
                      <Text
                        className={`text-sm ${active ? "text-on-accent font-medium" : "text-secondary"}`}
                      >
                        {timeoutLabel(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="h-px bg-border" />
            <View className="px-4 py-4">
              <Text className="text-primary text-base font-medium">
                Confirm trades over {formatUsd(prefs.tradeThresholdUsd)}
              </Text>
              <Text className="text-secondary text-sm mt-0.5">
                Larger trades ask for {method} again.
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
