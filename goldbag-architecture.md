# Goldbag — Architecture Document

**Version:** 0.1 (Draft)
**Date:** 2026-07-27
**Companion doc:** `goldbag-prd.md` (v0.2)
**Scope:** Backend (Node.js/TypeScript/PostgreSQL) + Mobile app (React Native/Expo). Covers storage, data flows, state management, navigation, folder structure, and dependencies.

---

## 1. Architectural Principles

1. **Non-custodial, always.** Private keys live only in the user's Privy embedded wallet on-device. The backend never sees, stores, or uses key material. Every backend capability must be reconstructible from public chain data + our own event log.
2. **The backend is an index and a router.** It caches prices, builds transactions, watches the chain, and computes derived data (P/L, history). It is never the source of truth for balances — the chain is.
3. **Chain-agnostic core, Solana adapter first.** All persistence and service interfaces are keyed by `(chain, address)` and go through a `ChainAdapter` interface (PRD posture 3). Solana is the only adapter in MVP.
4. **One deployable backend (modular monolith).** A single Node process family (API + workers) with strict internal module boundaries. Microservices are a scale problem we don't have; module boundaries keep the door open.
5. **Types flow end to end.** One pnpm monorepo; request/response schemas defined once in Zod, shared between API and app.

---

## 2. System Overview

```
                ┌─────────────────────────────────────────────┐
                │           React Native app (Expo)           │
                │  Privy SDK (auth + embedded Solana wallet)  │
                │  signs transactions ON DEVICE               │
                └───────┬─────────────────────────┬───────────┘
                        │ HTTPS (REST)            │ WSS (live prices,
                        │                         │  trade/deposit events)
                ┌───────▼─────────────────────────▼───────────┐
                │              Goldbag API (Fastify)          │
                │  auth │ assets │ quotes/trades │ portfolio  │
                └──┬────────┬──────────┬──────────────┬───────┘
                   │        │          │              │
             ┌─────▼──┐ ┌───▼───┐ ┌────▼─────┐  ┌─────▼─────┐
             │Postgres│ │ Redis │ │ BullMQ    │  │ Privy API │
             │(system │ │(cache,│ │ workers   │  │ (token    │
             │of      │ │pub/sub│ │ (below)   │  │  verify)  │
             │record) │ │ rate  │ └────┬──────┘  └───────────┘
             └────────┘ │ limit)│      │
                        └───────┘      │
        ┌──────────────┬───────────────┼──────────────┐
        │              │               │              │
  ┌─────▼─────┐  ┌─────▼──────┐  ┌─────▼─────┐  ┌─────▼─────┐
  │ price-    │  │ deposit-   │  │ trade-    │  │ notifier  │
  │ poller    │  │ watcher    │  │ tracker   │  │ (FCM/APNs)│
  └─────┬─────┘  └─────┬──────┘  └─────┬─────┘  └───────────┘
        │              │               │
  ┌─────▼──────┐ ┌─────▼──────────────▼──────────────────┐
  │ Birdeye /  │ │  Solana (Helius RPC + webhooks,       │
  │ Jupiter    │ │  Jupiter swap API, mainnet)           │
  │ price API  │ └───────────────────────────────────────┘
  └────────────┘
```

Two deployable processes from one codebase: `api` (HTTP + WS) and `worker` (BullMQ consumers + schedulers). Both scale horizontally; Redis coordinates them.

---

## 3. Monorepo Layout

```
goldbag/
  apps/
    mobile/            # Expo React Native app
    api/               # Fastify API + workers (two entrypoints, one codebase)
  packages/
    shared/            # Zod schemas, API types, chain registry, constants
    config/            # shared tsconfig, eslint config
  pnpm-workspace.yaml
  turbo.json           # task orchestration (build, typecheck, lint, test)
```

`packages/shared` is the contract: every API route's request/response schema lives here as Zod, inferred into TS types consumed by both sides. No OpenAPI generation step in MVP — Zod is the single source.

---

## 4. Backend Architecture (`apps/api`)

### 4.1 Technology Choices

| Concern | Choice | Why (trade-off) |
|---|---|---|
| HTTP framework | **Fastify** | Faster than Express, first-class TypeScript + Zod integration (`fastify-type-provider-zod`), schema-validated routes by default. Express is more familiar but buys nothing here. |
| ORM | **Prisma** | Velocity + migrations + typed client. Drizzle is lighter/faster but Prisma's DX wins for a small team; revisit if query performance becomes an issue. |
| Cache / pub-sub / rate limit | **Redis** (Upstash or managed) | One dependency covers price cache, WS fan-out, BullMQ, and rate limiting. |
| Job queue | **BullMQ** | Redis-backed, delayed jobs + retries with backoff — exactly what trade confirmation and deposit processing need. |
| Solana | `@solana/web3.js` v2 + **Helius** (RPC + webhooks) + **Jupiter API** (quotes/swaps) | Helius webhooks replace hand-rolled address polling; Jupiter handles routing + platform fee. |
| Auth | **Privy server SDK** (verify access tokens) | The app never invents its own auth; every request carries a Privy access token, verified server-side, mapped to our `users` row. |
| Validation | **Zod** everywhere | Shared with mobile via `packages/shared`. |
| Logging/observability | **pino** + Sentry + OpenTelemetry traces | Structured logs with tx signatures; redaction list for secrets. |

### 4.2 Module Structure

```
apps/api/src/
  index.ts               # api entrypoint (env validation first, then boot)
  worker.ts              # worker entrypoint
  config/
    env.ts               # zod-validated env schema; process exits on failure
  modules/
    auth/                # Privy token verification, user upsert, sessions
    users/               # profile, devices (push tokens), app-lock prefs
    assets/              # registry CRUD (admin), listing, search
    market/              # prices, candles, 24h stats (reads cache, falls back to provider)
    watchlist/
    trade/               # quote, build, submit, track
    portfolio/           # balances, cost basis, P/L, activity feed
    deposits/            # webhook ingestion, confirmation, notification
    notifications/       # FCM/APNs dispatch
  chains/
    types.ts             # ChainAdapter interface
    solana/              # SolanaAdapter: Helius, Jupiter, tx build/submit/confirm
  lib/
    db.ts, redis.ts, queue.ts, logger.ts, ws.ts
  jobs/                  # BullMQ processors: price-poll, trade-track, deposit-confirm, notify
```

Module rule: modules talk to each other through exported service functions, never by importing another module's Prisma queries. `chains/` is only reachable from `trade/`, `deposits/`, and `portfolio/`.

### 4.3 The ChainAdapter Interface (posture 3 made concrete)

```typescript
interface ChainAdapter {
  chain: ChainId;                                      // 'solana' | 'ethereum' (future)
  getTokenBalances(address: string): Promise<TokenBalance[]>;
  getQuote(params: QuoteParams): Promise<Quote>;        // wraps Jupiter /quote
  buildSwapTx(quote: Quote, userAddress: string): Promise<UnsignedTx>; // base64, fee config attached
  submitSignedTx(signedTx: string): Promise<TxSignature>;
  getTxStatus(sig: TxSignature): Promise<'pending' | 'confirmed' | 'failed'>;
  parseIncomingTransfers(webhookPayload: unknown): IncomingTransfer[];
}
```

Everything above this interface (orders, portfolio, deposits) is chain-agnostic. Adding Ethereum later = new adapter + new rows in the asset registry, no schema change.

### 4.4 Data Storage

**PostgreSQL — system of record for everything *we* originate; index for everything the chain originates.**

```
users            id, privy_user_id (uq), email, created_at, app_lock_prefs
wallets          id, user_id, chain, address (uq per chain), is_primary
assets           id, chain, token_address, symbol, name, category      -- (chain, token_address) unique
                 (stock|etf|gold_silver), logo_url, decimals,
                 status (listed|paused|delisted), listed_at
asset_stats      asset_id, price_usd, change_24h_pct, volume_24h,     -- hot row, upserted by price-poller
                 liquidity_usd, updated_at
candles          asset_id, interval (1m|15m|1h|1d), ts, o, h, l, c    -- partitioned by interval; 1m rows TTL 7d
watchlist_items  user_id, asset_id, created_at                        -- PK (user_id, asset_id)
orders           id, user_id, wallet_id, asset_id, side (buy|sell),
                 status (quoted|awaiting_signature|submitted|confirmed|failed),
                 input_token, input_amount, quoted_output, executed_output,
                 price_impact_bps, fee_bps, tx_signature, error_code, timestamps...
deposits         id, wallet_id, token (usdc|usdt), amount, tx_signature (uq),
                 status (seen|confirmed), detected_at, confirmed_at
position_lots    id, wallet_id, asset_id, quantity, cost_usd, acquired_at  -- avg-cost basis source
push_tokens      user_id, device_id, platform, token
notifications    id, user_id, type, payload, sent_at
```

Money/quantity columns are `DECIMAL`, never floats. All chain amounts stored in human units with the asset's `decimals` recorded; conversion to base units happens only inside the chain adapter, using BigInt.

**Redis — everything hot and reconstructible:**
- `price:{assetId}` — latest price JSON, TTL 60s (price-poller writes every 5–15s)
- `quote:{orderId}` — Jupiter quote payload, TTL 30s (a quote is only valid briefly)
- Pub/sub channels: `prices`, `user:{id}:events` → fanned out over WebSocket
- BullMQ queues: `trade-track`, `deposit-confirm`, `notify`
- Rate-limit counters per IP and per user

**What we deliberately don't store:** balances. Portfolio reads come from `getTokenBalances` (cached 15s in Redis) joined with `asset_stats` prices; `position_lots` only supplies cost basis. If our index is ever wrong, the chain corrects it on next read.

### 4.5 Key Data Flows

**Auth (every request)**
```
App: Privy login → Privy access token
 → API middleware: verify token (Privy SDK, keys cached) → upsert user + wallet row on first sight
 → req.user = { userId, walletAddress }
```

**Trade (the critical path)**
```
1. App    POST /trade/quote {assetId, side, amountUsd}
2. API    → adapter.getQuote (Jupiter, platform fee attached)
          → create orders row (status=quoted), cache quote in Redis (TTL 30s)
          → return {orderId, estTokens, priceImpact, fees, expiresAt}
3. App    user confirms (slide + haptic)
          POST /trade/{orderId}/build → API returns base64 unsigned tx (status=awaiting_signature)
4. App    Privy wallet signs ON DEVICE
          POST /trade/{orderId}/submit {signedTx}
5. API    adapter.submitSignedTx → status=submitted, enqueue trade-track job
6. Worker polls getTxStatus (backoff: 1s, 2s, 4s... max 60s)
          confirmed → status=confirmed, write position_lots (buy) or consume lots (sell),
                      publish user event (WS) + push notification
          failed    → status=failed + mapped error_code (slippage|blockhash_expired|insufficient_funds|network)
7. App    live status via WS; explorer link from tx_signature
```
Trade-offs made explicit: the **backend submits** the signed tx (not the client) so we get reliable status tracking, fee attribution, and analytics from one place; cost is one extra hop (~100ms) and the API being on the critical path. The client-submit fallback is trivial to add later since the tx is fully signed either way. Quotes expire in 30s — a stale confirm returns `QUOTE_EXPIRED` and the app silently re-quotes.

**Deposit**
```
Helius webhook (address activity) → POST /webhooks/helius (HMAC verified)
 → parseIncomingTransfers → upsert deposits row (tx_signature unique = idempotent)
 → enqueue deposit-confirm job → on confirmation: status=confirmed,
   publish WS event + push "Your 50 USDC has arrived"
```

**Prices**
```
price-poller (every 5–15s, batched): provider API → asset_stats upsert + Redis + pub/sub `prices`
candle-builder (every 1m): provider OHLC → candles table (backfill on new asset listing)
App chart request: GET /market/{assetId}/candles?interval=1d  → Postgres, cache headers
App live prices: WS subscription `prices` → only assets on the visible screen
```

### 4.6 API Surface (REST + WS)

```
POST  /auth/session                      # exchange Privy token, upsert user
GET   /assets?category=&search=&cursor=  # paginated registry
GET   /market/prices?ids=                # batch latest prices
GET   /market/:assetId/candles?interval=
GET   /watchlist        POST /watchlist/:assetId        DELETE /watchlist/:assetId
POST  /trade/quote      POST /trade/:orderId/build      POST /trade/:orderId/submit
GET   /trade/:orderId
GET   /portfolio                          # holdings + P/L
GET   /activity?cursor=                   # deposits + trades feed
GET   /wallet/deposit-info                # address + supported tokens
POST  /devices                            # register push token
POST  /webhooks/helius                    # HMAC-authenticated, not user-facing
WS    /ws                                 # auth via token; channels: prices, user events
```

Response envelope: `{ data }` or `{ error: { code, message } }` — `code` is a stable machine string the app maps to friendly copy; raw provider/chain errors never leave the API.

---

## 5. Mobile Architecture (`apps/mobile`)

### 5.1 Technology Choices

| Concern | Choice | Why (trade-off) |
|---|---|---|
| Framework | **Expo SDK (latest), dev-client builds + EAS** | Privy Expo SDK requires config plugins → not Expo Go, but full Expo tooling (EAS Build/Submit/Update) stays. |
| Navigation | **Expo Router** (file-based, typed routes) | File-system routing + deep links for free; typed `href`s. React Navigation underneath, so escape hatches exist. |
| Server state | **TanStack Query** | All API data: caching, refetch, optimistic updates, pull-to-refresh. Nothing from the API is ever copied into a client store. |
| Client state | **Zustand** (small stores) | Only true client state: trade-ticket draft, UI prefs, onboarding step. Redux is overkill; Context alone causes re-render sprawl. |
| Auth/wallet state | **Privy Expo SDK provider** | `usePrivy()` is the single source for auth + wallet; a thin `useSession` hook adapts it for the rest of the app. |
| Persistence | **MMKV** (+ TanStack Query persister) | Fast synchronous storage for query cache (instant cold-start UI) and prefs. Secrets never go here. |
| Secure storage | **expo-secure-store** / Keychain | Session material, app-lock settings. Key custody itself is inside Privy's SDK. |
| Charts | **victory-native XL** (Skia-based) + `react-native-gesture-handler` | 60fps chart scrubbing on the UI thread; the Moonshot benchmark rules out JS-thread SVG charts. |
| Animation/haptics | **react-native-reanimated** + **expo-haptics** | Slide-to-confirm, success animations, haptic taxonomy (see 5.5). |
| Live data | Native WebSocket + tiny reconnecting client | Feeds prices into the TanStack Query cache via `queryClient.setQueryData` — components just read queries, no separate "socket state". |
| Styling | **NativeWind** (Tailwind for RN) + design tokens | Fast iteration, consistent dark theme; tokens in one file. |
| Testing | Jest + React Native Testing Library; Maestro for E2E flows | E2E covers: onboarding, deposit-detect (mocked), buy, sell, key export. |

### 5.2 Folder Structure

```
apps/mobile/
  app/                          # Expo Router — routes only, thin files
    _layout.tsx                 # providers: Privy, QueryClient, theme, WS
    (onboarding)/
      welcome.tsx  login.tsx  fund.tsx
    (main)/                     # requires session; tab navigator
      _layout.tsx               # tabs: Home, Markets, Portfolio, Account
      index.tsx                 # Home: buying power, watchlist, movers
      markets/index.tsx
      markets/[assetId].tsx     # asset detail: chart, stats, buy/sell CTA
      portfolio/index.tsx
      account/index.tsx  account/wallet.tsx  account/export-key.tsx
    trade/[assetId].tsx         # modal stack: ticket → confirm → status
    activity/[txId].tsx
  src/
    features/                   # screen logic lives here, not in app/
      auth/        # useSession, app-lock (biometric gate)
      market/      # queries, chart data hooks, search
      trade/       # ticket store (zustand), quote/build/submit mutations, status machine
      portfolio/   # holdings + activity queries
      wallet/      # deposit info, key export flow (multi-step warning)
      watchlist/
    components/
      ui/          # Button, Sheet, Skeleton, AmountInput, SlideToConfirm...
      chart/       # PriceChart (victory-native XL wrapper)
    lib/
      api/         # typed client generated over packages/shared zod schemas
      ws.ts        # reconnecting socket → query cache bridge
      haptics.ts   # semantic haptic API (see 5.5)
      format.ts    # money/quantity formatting (Intl, never toFixed on floats)
    stores/        # zustand: tradeTicket, uiPrefs
    theme/         # tokens: colors, spacing, typography (dark-first)
  app.config.ts    # Expo config + Privy/Skia plugins
```

Rule: files in `app/` are route shells (layout + composition); logic and queries live in `src/features/*`. This keeps navigation refactors cheap.

### 5.3 State Management Model

Four state domains, four owners — never cross-copied:

```
1. Server state   → TanStack Query      (assets, prices, portfolio, activity, order status)
2. Session state  → Privy SDK provider  (auth status, wallet address, signing)
3. Client state   → Zustand             (trade ticket draft, UI prefs, onboarding progress)
4. Ephemeral      → component useState  (input focus, sheet visibility)
```

Live prices pattern: WS messages call `queryClient.setQueryData(['price', assetId], ...)`; every component that shows a price uses `usePrice(assetId)`. One update path whether data arrived by REST or socket. The trade status screen subscribes to `['order', orderId]`, updated by WS events with a polling fallback if the socket drops.

### 5.4 Navigation Map

```
RootLayout (Privy + QueryClient + WS providers, app-lock gate)
├── (onboarding) stack — no session
│     welcome → login (Privy email/social) → fund (address + QR, skippable)
├── (main) tabs — session required
│     Home │ Markets │ Portfolio │ Account
│     Markets → markets/[assetId] (chart, stats) ──┐
├── trade/[assetId]  (modal)  ◄────────────────────┘
│     ticket (amount) → confirm (SlideToConfirm) → status (live) → done
└── account/export-key (modal, biometric-gated, 3-step warning)
```

Deep links (`goldbag://asset/AAPLx`) come free with Expo Router — needed later for price-alert notifications (P1).

### 5.5 UX-Critical Implementation Notes

- **Haptic taxonomy** (single `haptics.ts` module): `selection` (favourite, tab), `impactLight` (ticket keypad), `impactMedium` (slide-to-confirm progress), `notificationSuccess` (trade confirmed), `notificationError` (trade failed). No ad-hoc haptic calls in components.
- **App lock:** biometric/PIN gate at cold start and on foreground after N minutes; re-prompt for key export and trades above the user's threshold. Implemented as a top-level overlay in `_layout.tsx`, not per-screen.
- **Key export:** renders the key only after fresh biometric auth, in a screenshot-blocked screen (`expo-screen-capture`), never touches logs/clipboard analytics, cleared from memory on blur.
- **Every query screen** ships loading skeleton + empty + error states via a shared `<QueryBoundary>` wrapper — this is how the PRD's "no blank screens" bar is enforced structurally rather than by review.

---

## 6. Cross-Cutting Concerns

**Security**
- API: Privy token verification on every route; per-user + per-IP rate limits; Zod validation on every body/query; HMAC on Helius webhooks; secrets in the platform secret manager; pino redaction list.
- No PII beyond email; no KYC data exists to breach.
- Admin endpoints (asset registry) live under `/admin`, protected by a separate allowlist token, not user auth — MVP admin is `curl`/internal dashboard.

**Error taxonomy** — one enum in `packages/shared` (`QUOTE_EXPIRED`, `SLIPPAGE_EXCEEDED`, `INSUFFICIENT_BALANCE`, `NETWORK_CONGESTION`, ...); API maps provider/chain errors into it; the app maps it to copy. New error strings require a shared-package change, which forces the copy discussion.

**Numbers** — `DECIMAL` in Postgres, decimal.js (or Prisma Decimal) in the API, base-unit BigInt only inside chain adapters, `Intl.NumberFormat` in the app. JS floats never touch money.

**Deployment & environments**
- API + worker on Railway/Fly (Docker, one image, two commands); managed Postgres (Neon/Supabase/RDS); Upstash Redis; Sentry.
- Mobile: EAS Build + Submit; EAS Update for OTA JS fixes (within store policy); `dev` / `staging` / `prod` app variants pointing at matching APIs.
- CI (GitHub Actions): typecheck + lint + unit tests on PR; Maestro E2E on staging builds; `prisma migrate deploy` gated in the deploy pipeline.

**Load assumptions (MVP targets from PRD)**
10k funded wallets ≈ low thousands DAU ≈ tens of req/s peak + a few thousand concurrent WS connections. A single modest API instance + one worker handles this; the design scales horizontally (stateless API, Redis-coordinated workers) to ~100× before anything needs rethinking.

---

## 7. What We'd Revisit as We Grow

| Trigger | Revisit |
|---|---|
| Onramp lands (P1→P0) | Payments module; possibly Stripe-native via Privy; webhook surface grows |
| Ethereum/gold expansion | Second `ChainAdapter`; per-chain gas strategy; multi-address wallet UX |
| >50k DAU or heavy chart usage | Move candles to Timescale/ClickHouse; dedicated WS gateway |
| Limit orders / DCA (P2) | `orders` already intent-shaped; add an execution scheduler worker |
| Admin needs outgrow curl | Small internal Next.js admin app in the monorepo |
| Prisma query bottlenecks | Targeted raw SQL or Drizzle migration for hot paths |

---

## 8. Dependency Summary

**Backend:** fastify, fastify-type-provider-zod, zod, prisma/@prisma/client, bullmq, ioredis, @solana/web3.js, @privy-io/server-auth, pino, @sentry/node, decimal.js · Infra: Helius, Jupiter API, Birdeye (or Jupiter price API), FCM/APNs, Upstash Redis, managed Postgres.

**Mobile:** expo, expo-router, @privy-io/expo, @tanstack/react-query, zustand, react-native-mmkv, expo-secure-store, victory-native (XL), @shopify/react-native-skia, react-native-reanimated, react-native-gesture-handler, nativewind, expo-haptics, expo-local-authentication, expo-screen-capture, @sentry/react-native · Tooling: EAS, Maestro, Jest + RNTL.

**Shared:** zod, typescript, turbo, pnpm.

Pin exact versions for: `@privy-io/expo`, `@solana/web3.js`, `react-native-skia`, `reanimated` — all four have breaking-change history; upgrades only with the E2E suite green.
