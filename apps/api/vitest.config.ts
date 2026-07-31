import { defineConfig } from "vitest/config";

// Integration suites share one dev database; parallel files interfere
// (transient assets, global fetch stubs, redis price keys). Sequential
// execution trades a little speed for determinism.
export default defineConfig({
  test: { fileParallelism: false },
});
