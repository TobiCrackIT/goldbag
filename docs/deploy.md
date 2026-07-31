# Deploying Goldbag (staging)

CI is live and gating (`.github/workflows/ci.yml`). The staging deploy below
needs accounts that only the founder can create — everything else is ready.

## What's already done

- One Docker image, two process groups (api + worker) — [`fly.staging.toml`](../fly.staging.toml)
- Migrations run automatically per deploy via `release_command`
- Health check wired to `GET /health`
- CI: typecheck + lint + test against Postgres 16 + Redis 7 service containers,
  on every PR and push to `main`

## Accounts needed

| Service | Purpose | Notes |
|---|---|---|
| **Fly.io** | api + worker | `brew install flyctl && fly auth login` |
| **Neon** (or Fly Postgres) | managed Postgres | Free tier is fine for staging |
| **Upstash** | managed Redis | Free tier is fine for staging |
| **Sentry** | error tracking | Optional for staging, required before beta |

## First deploy

```bash
fly launch --no-deploy -c fly.staging.toml   # claims the app name
fly secrets set -c fly.staging.toml \
  DATABASE_URL="postgresql://…"   \
  REDIS_URL="rediss://…"          \
  PRIVY_APP_ID="…"                \
  PRIVY_APP_SECRET="…"            \
  ADMIN_TOKEN="$(openssl rand -hex 24)"
fly deploy -c fly.staging.toml
```

Use a **separate Privy app** for staging — never the production credentials.

## Verifying the deploy (task 1.9 acceptance)

```bash
# 1. health
curl https://goldbag-api-staging.fly.dev/health          # → {"data":{"status":"ok"}}

# 2. registry seeded + prices flowing (poller runs in the worker process)
curl https://goldbag-api-staging.fly.dev/assets | jq '.data.items[].symbol'
curl "https://goldbag-api-staging.fly.dev/market/prices?ids=<assetId>" | jq

# 3. live price over the websocket
#    (docs/spikes/price-vendor/sample.mjs shows the same data path)
```

Seed the registry once after the first deploy:

```bash
fly ssh console -c fly.staging.toml -C "sh -c 'cd /repo/apps/api && npx tsx prisma/seed.ts'"
```

## Notes

- `primary_region = "jnb"` (Johannesburg) reflects the Africa/LatAm beachhead.
  Put Postgres in the same region — a cross-region DB hop costs more latency
  than anything else in the request path.
- The worker process group has no public port; it only needs the same
  `DATABASE_URL` / `REDIS_URL` secrets.
