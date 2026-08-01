import { createMMKV } from "react-native-mmkv";

/**
 * Fast synchronous storage for the query cache and UI prefs.
 * Secrets never go here — session material lives in expo-secure-store and
 * key custody stays inside the wallet SDK (architecture §5.1).
 */
export const storage = createMMKV({ id: "goldbag" });

/** Shape TanStack's sync persister expects. (v4 renamed delete -> remove.) */
export const mmkvPersistAdapter = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
};
