import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  normalizePrefs,
  requiresReauthForTrade,
  shouldLockOnColdStart,
  shouldLockOnForeground,
  type AppLockPrefs,
} from "../src/features/auth/app-lock/policy";

const prefs = (over: Partial<AppLockPrefs> = {}): AppLockPrefs => ({ ...DEFAULT_PREFS, ...over });
const MIN = 60_000;

describe("cold start", () => {
  it("locks when enabled, stays open when disabled", () => {
    expect(shouldLockOnColdStart(prefs())).toBe(true);
    expect(shouldLockOnColdStart(prefs({ enabled: false }))).toBe(false);
  });
});

describe("foreground re-lock", () => {
  const now = 1_000_000_000;

  it("locks once the timeout has elapsed, not before", () => {
    const p = prefs({ timeoutMinutes: 5 });
    expect(shouldLockOnForeground(p, now - 4 * MIN, now)).toBe(false);
    expect(shouldLockOnForeground(p, now - 5 * MIN, now)).toBe(true);
    expect(shouldLockOnForeground(p, now - 60 * MIN, now)).toBe(true);
  });

  it("locks immediately when the timeout is zero", () => {
    expect(shouldLockOnForeground(prefs({ timeoutMinutes: 0 }), now - 1, now)).toBe(true);
  });

  it("locks when we never saw the app leave — unknown state hides money", () => {
    expect(shouldLockOnForeground(prefs(), null, now)).toBe(true);
  });

  it("locks if the clock moved backwards, so a clock change can't bypass the gate", () => {
    // Device clock set forward while backgrounded, then corrected.
    expect(shouldLockOnForeground(prefs({ timeoutMinutes: 5 }), now + 10 * MIN, now)).toBe(true);
  });

  it("never locks when the feature is disabled", () => {
    expect(shouldLockOnForeground(prefs({ enabled: false }), null, now)).toBe(false);
  });
});

describe("trade re-auth threshold", () => {
  it("prompts at or above the threshold", () => {
    const p = prefs({ tradeThresholdUsd: 100 });
    expect(requiresReauthForTrade(p, 99.99)).toBe(false);
    expect(requiresReauthForTrade(p, 100)).toBe(true);
    expect(requiresReauthForTrade(p, 5000)).toBe(true);
  });

  it("a zero threshold prompts for every trade", () => {
    expect(requiresReauthForTrade(prefs({ tradeThresholdUsd: 0 }), 1)).toBe(true);
  });
});

describe("prefs normalisation", () => {
  it("falls back to safe defaults for junk from storage", () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs("corrupt")).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({})).toEqual(DEFAULT_PREFS);
  });

  it("rejects out-of-range values rather than trusting them", () => {
    expect(normalizePrefs({ timeoutMinutes: -5 }).timeoutMinutes).toBe(
      DEFAULT_PREFS.timeoutMinutes,
    );
    expect(normalizePrefs({ timeoutMinutes: 9999 }).timeoutMinutes).toBe(
      DEFAULT_PREFS.timeoutMinutes,
    );
    expect(normalizePrefs({ tradeThresholdUsd: -1 }).tradeThresholdUsd).toBe(
      DEFAULT_PREFS.tradeThresholdUsd,
    );
  });

  it("keeps valid values, including a deliberate opt-out", () => {
    expect(normalizePrefs({ enabled: false, timeoutMinutes: 0, tradeThresholdUsd: 250 })).toEqual({
      enabled: false,
      timeoutMinutes: 0,
      tradeThresholdUsd: 250,
    });
  });

  it("defaults to locked — an app that fails open is worse than one that annoys", () => {
    expect(DEFAULT_PREFS.enabled).toBe(true);
  });
});
