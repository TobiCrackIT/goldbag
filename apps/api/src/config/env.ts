import { z } from "zod";

/**
 * Zod-validated environment. Loaded once at boot; the process exits on any
 * invalid or missing variable rather than limping along misconfigured.
 * Every variable added here must also appear in `.env.example`.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^redis(s)?$/ }).default("redis://localhost:6379"),
  // Auth vendor credentials (Privy adapter). Optional so infra-free
  // commands still boot; the auth plugin refuses to register without them.
  PRIVY_APP_ID: z.string().min(1).optional(),
  PRIVY_APP_SECRET: z.string().min(1).optional(),
  // Allowlist token for /admin routes (curl/internal dashboard — PRD §6).
  // Admin routes stay disabled when unset.
  ADMIN_TOKEN: z.string().min(16).optional(),
  // Price vendor (docs/spikes/price-vendor/REPORT.md): Jupiter lite tier;
  // swap base URL for the keyed portal tier when we outgrow it.
  JUPITER_BASE_URL: z.url().default("https://lite-api.jup.ag"),
  PRICE_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(10_000),
  // Chart backfill on new listings only (never the hot path).
  GECKOTERMINAL_BASE_URL: z.url().default("https://api.geckoterminal.com/api/v2"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Logger isn't up yet — env comes first. Plain stderr is correct here.
    console.error("Fatal: invalid environment configuration\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}
