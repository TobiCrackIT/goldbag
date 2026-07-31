/**
 * Pure app-lock policy. Kept free of React and native modules so the
 * rules that decide when funds are hidden can be unit-tested directly,
 * rather than only through a device.
 */

export interface AppLockPrefs {
  /** Master switch. Off means the gate never appears. */
  enabled: boolean;
  /** Re-lock after this long in the background. 0 = lock immediately. */
  timeoutMinutes: number;
  /** Trades at or above this USD amount re-prompt (PRD 7.1, used by 4.10). */
  tradeThresholdUsd: number;
}

export const DEFAULT_PREFS: AppLockPrefs = {
  enabled: true,
  timeoutMinutes: 5,
  tradeThresholdUsd: 100,
};

/** Coerce anything read from storage into valid prefs. */
export function normalizePrefs(value: unknown): AppLockPrefs {
  if (typeof value !== "object" || value === null) return DEFAULT_PREFS;
  const v = value as Partial<AppLockPrefs>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_PREFS.enabled,
    timeoutMinutes:
      typeof v.timeoutMinutes === "number" && v.timeoutMinutes >= 0 && v.timeoutMinutes <= 60
        ? v.timeoutMinutes
        : DEFAULT_PREFS.timeoutMinutes,
    tradeThresholdUsd:
      typeof v.tradeThresholdUsd === "number" && v.tradeThresholdUsd >= 0
        ? v.tradeThresholdUsd
        : DEFAULT_PREFS.tradeThresholdUsd,
  };
}

/**
 * Should the app be locked when returning to the foreground?
 *
 * A missing backgrounded timestamp means we never saw the app leave —
 * treat that as "lock", because the safe default when state is unknown
 * is to hide the money.
 */
export function shouldLockOnForeground(
  prefs: AppLockPrefs,
  backgroundedAt: number | null,
  now: number,
): boolean {
  if (!prefs.enabled) return false;
  if (backgroundedAt === null) return true;
  const elapsedMs = now - backgroundedAt;
  // A clock that moved backwards (NTP correction, manual change) must not
  // be readable as "no time passed".
  if (elapsedMs < 0) return true;
  return elapsedMs >= prefs.timeoutMinutes * 60_000;
}

/** Cold start always locks when the feature is on. */
export function shouldLockOnColdStart(prefs: AppLockPrefs): boolean {
  return prefs.enabled;
}

/** Does this trade need a fresh biometric check? (wired in task 4.10) */
export function requiresReauthForTrade(prefs: AppLockPrefs, amountUsd: number): boolean {
  if (!prefs.enabled) return false;
  return amountUsd >= prefs.tradeThresholdUsd;
}
