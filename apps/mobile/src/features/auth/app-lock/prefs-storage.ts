import * as SecureStore from "expo-secure-store";
import { normalizePrefs, DEFAULT_PREFS, type AppLockPrefs } from "./policy";

/**
 * App-lock settings live in the keychain, not MMKV: they are security
 * configuration, and MMKV is readable from a rooted device or a backup.
 */
const KEY = "goldbag.app-lock.prefs";

export async function loadPrefs(): Promise<AppLockPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULT_PREFS;
    return normalizePrefs(JSON.parse(raw));
  } catch {
    // Corrupt or unreadable keychain entry: fall back to the safe default
    // (locked) rather than leaving the app open.
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: AppLockPrefs): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(prefs));
}

export async function clearPrefs(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
