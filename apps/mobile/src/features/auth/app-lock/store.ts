import { create } from "zustand";
import { authenticate } from "./biometrics";
import { loadPrefs, savePrefs } from "./prefs-storage";
import {
  DEFAULT_PREFS,
  shouldLockOnColdStart,
  shouldLockOnForeground,
  type AppLockPrefs,
} from "./policy";

/**
 * App-lock state machine.
 *
 * `obscured` is distinct from `locked`: the moment the app becomes
 * inactive we cover the screen so the OS app-switcher snapshot doesn't
 * capture balances, even when the timeout hasn't elapsed and no prompt
 * is required on return.
 */
export type LockStatus = "initialising" | "locked" | "unlocked" | "authenticating";

interface AppLockState {
  status: LockStatus;
  obscured: boolean;
  prefs: AppLockPrefs;
  backgroundedAt: number | null;

  init: () => Promise<void>;
  unlock: () => Promise<boolean>;
  onBackground: () => void;
  onForeground: () => void;
  setPrefs: (next: Partial<AppLockPrefs>) => Promise<void>;
  /** Fresh check for a sensitive action (key export, large trade). */
  requireFreshAuth: (reason: string) => Promise<boolean>;
}

export const useAppLockStore = create<AppLockState>((set, get) => ({
  status: "initialising",
  obscured: false,
  prefs: DEFAULT_PREFS,
  backgroundedAt: null,

  async init() {
    const prefs = await loadPrefs();
    set({ prefs, status: shouldLockOnColdStart(prefs) ? "locked" : "unlocked" });
  },

  async unlock() {
    if (get().status === "authenticating") return false;
    set({ status: "authenticating" });
    const result = await authenticate("Unlock Goldbag");
    if (result === "success") {
      set({ status: "unlocked", obscured: false, backgroundedAt: null });
      return true;
    }
    // Cancelled, failed or unavailable — content stays hidden. The gate
    // offers a retry; there is no path that reveals balances on failure.
    set({ status: "locked" });
    return false;
  },

  onBackground() {
    // Cover immediately, regardless of timeout: this is snapshot privacy.
    set({ obscured: true, backgroundedAt: Date.now() });
  },

  onForeground() {
    const { prefs, backgroundedAt, status } = get();
    if (status === "authenticating") return; // system prompt backgrounded us
    const lock = shouldLockOnForeground(prefs, backgroundedAt, Date.now());
    set({ status: lock ? "locked" : status, obscured: false });
  },

  async setPrefs(next) {
    const prefs = { ...get().prefs, ...next };
    await savePrefs(prefs);
    set({ prefs });
  },

  async requireFreshAuth(reason) {
    if (!get().prefs.enabled) return true;
    return (await authenticate(reason)) === "success";
  },
}));
