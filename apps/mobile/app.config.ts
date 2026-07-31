import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Three app variants (dev / staging / prod) with distinct bundle ids and
 * schemes so all three can sit on one device at once. Select with
 * APP_VARIANT; defaults to dev.
 */
type Variant = "dev" | "staging" | "prod";
const variant = (process.env.APP_VARIANT ?? "dev") as Variant;

const VARIANTS: Record<Variant, { name: string; id: string; scheme: string; api: string }> = {
  dev: {
    name: "Goldbag Dev",
    id: "com.goldbag.app.dev",
    scheme: "goldbag-dev",
    // Simulators reach the host machine on localhost; Android emulators
    // use 10.0.2.2. Override with EXPO_PUBLIC_API_URL when needed.
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

const active = VARIANTS[variant];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: active.name,
  slug: "goldbag",
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
  plugins: [
    "expo-router",
    "expo-dev-client",
    ["@sentry/react-native/expo", { organization: "goldbag", project: "mobile" }],
  ],
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
  },
});
