import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Node-side tests for the platform-agnostic layers (API client, error
 * copy, formatting). React Native modules are aliased to stubs; anything
 * needing a real device is covered by the Maestro E2E suite instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      "expo-constants": path.resolve(__dirname, "tests/stubs/expo-constants.ts"),
      "react-native": path.resolve(__dirname, "tests/stubs/react-native.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
