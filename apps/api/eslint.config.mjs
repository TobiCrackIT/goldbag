import base from "@goldbag/config/eslint";

export default [
  ...base,
  {
    // Vendor seam enforcement (architecture §4.3b): auth vendor SDKs may
    // only be imported inside modules/auth/providers/<vendor>/.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@privy-io/*"],
              message:
                "Vendor SDKs are confined to src/modules/auth/providers/ (architecture §4.3b).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/auth/providers/**"],
    rules: { "no-restricted-imports": "off" },
  },
];
