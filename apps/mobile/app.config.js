/**
 * Three app variants (dev / staging / prod) with distinct bundle ids and
 * schemes so all three can sit on one device at once. Select with
 * APP_VARIANT; defaults to dev.
 *
 * Plain JS rather than TypeScript on purpose: the EAS CLI's config
 * loader fails to transpile app.config.ts under pnpm's resolution
 * ("Cannot read properties of undefined (reading 'CommonJS')"), and this
 * file has to be readable by every Expo tool — EAS, prebuild, Metro.
 */
const VARIANTS = {
  dev: {
    name: "Goldbag Dev",
    id: "com.goldbag.app.dev",
    scheme: "goldbag-dev",
    // Simulators reach the host machine on localhost; Android emulators
    // use 10.0.2.2 (handled in src/lib/api/client.ts). Override with
    // EXPO_PUBLIC_API_URL for a device on the LAN.
    api: "http://localhost:3000",
  },
  staging: {
    name: "Goldbag Staging",
    id: "com.goldbag.app.staging",
    scheme: "goldbag-staging",
    api: "https://goldbag-api-staging.fly.dev",
  },
  prod: {
    name: "Goldbag",
    id: "com.goldbag.app",
    scheme: "goldbag",
    api: "https://api.goldbag.app",
  },
};

const variant = process.env.APP_VARIANT ?? "dev";
const active = VARIANTS[variant];

/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  name: active.name,
  // NOTE: the EAS project was created with the slug "goldnag" (typo) and
  // expo.dev slugs are immutable, so this must match it or every eas
  // command fails. It only affects EAS dashboard URLs — the app name,
  // bundle ids and everything user-visible remain "Goldbag". To fix
  // properly, create a fresh EAS project named goldbag and swap the
  // projectId + slug together.
  slug: "goldnag",
  scheme: active.scheme,
  version: "0.1.0",
  orientation: "portrait",
  // Monochrome system supports both appearances; follow the device.
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: active.id,
    supportsTablet: false,
  },
  android: {
    package: active.id,
    adaptiveIcon: { backgroundColor: "#000000" },
  },
  web: { bundler: "metro" },
  // Sentry's config plugin is deliberately absent. It injects an "Upload
  // Debug Symbols to Sentry" build phase that runs sentry-cli, which
  // cannot resolve its own dependencies under pnpm's strict node_modules
  // (build 1 failed with node:internal/modules/cjs/loader). Setting
  // SENTRY_DISABLE_AUTO_UPLOAD only skips the upload — the phase still
  // runs and still crashes. Re-add once a real Sentry project, DSN and
  // SENTRY_AUTH_TOKEN exist, and verify the phase survives pnpm.
  plugins: ["expo-router", "expo-dev-client"],
  experiments: { typedRoutes: true },
  extra: {
    variant,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? active.api,
    // Privy app id + mobile client id are publishable (they ship in the
    // binary); the app secret is server-only and never appears here.
    privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "cms7q6t4200kb0cl81w6nikz4",
    privyClientId:
      process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ??
      "client-WY6c2hMSMc1KxpEBCyZcp1cVF4dFgqAyX6dptWLdXD66G",
    // Hosted key-export page (task 2.6). Unset until it's deployed, in
    // which case the session port reports export as unsupported rather
    // than pretending it works.
    keyExportUrl: process.env.EXPO_PUBLIC_KEY_EXPORT_URL ?? null,
    eas: { projectId: "116ab8d4-598b-4941-b6d1-69d2e8ceb65e" },
  },
  // The EAS project lives under the goldbag organisation account.
  owner: "goldbag",
});
