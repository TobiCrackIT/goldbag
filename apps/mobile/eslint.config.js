const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "ios/*", "android/*", ".expo/*"] },
  {
    // Vendor seam (architecture §5.6): the auth/wallet SDK may only be
    // imported inside features/auth/providers/<vendor>/. Everything else
    // consumes the WalletSession port, so swapping vendors is one
    // adapter rather than a rewrite.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@privy-io/*"],
              message:
                "Import the WalletSession port (features/auth/session) instead — vendor SDKs are confined to features/auth/providers/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/auth/providers/**"],
    rules: { "no-restricted-imports": "off" },
  },
]);
