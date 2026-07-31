# Goldbag — Build Tasks

**Companion docs:** `goldbag-prd.md` (v0.2) · `goldbag-architecture.md` (v0.1)
**Last updated:** 2026-07-29

## Workflow rules

- **One task = one branch = one commit (minimum).** Before starting a task, branch from `main`: `git checkout -b task/<id>-<slug>` (e.g. `task/1.3-privy-auth-middleware`). Commit when the task's **Verify** criterion passes, then merge to `main`.
- A task is **done** only when its Verify step passes. No task depends on an unfinished sibling — each leaves the repo in a working, demonstrable state.
- Tasks within a phase are ordered; phases 1 (backend) and 2 (mobile shell) can proceed in parallel once Phase 0 is complete.
- Secrets never committed; every task that adds an env var updates `.env.example` and the Zod env schema.

---

## Phase 0 — Foundations & de-risking spikes (~2 weeks)

> Goal: kill the three blocking unknowns (PRD §11) and stand up the monorepo skeleton. Nothing here is user-facing, but everything downstream depends on it.

- [x] **0.1 — Initialise repo & monorepo skeleton**
  `git init`, `.gitignore`, pnpm workspace (`apps/`, `packages/`), `turbo.json` with `build`/`typecheck`/`lint`/`test` pipelines, shared tsconfig + eslint in `packages/config`, root README.
  **Verify:** `pnpm install && pnpm turbo typecheck lint` passes on a clean clone.

- [x] **0.2 — `packages/shared`: core contracts**
  Zod schemas for the response envelope (`{data} | {error:{code,message}}`), the error-code enum (`QUOTE_EXPIRED`, `SLIPPAGE_EXCEEDED`, `INSUFFICIENT_BALANCE`, `NETWORK_CONGESTION`, …), `ChainId`, asset category enum, and branded decimal-string types for money.
  **Verify:** unit tests exercise valid/invalid parses; package builds and is importable from a scratch script.

- [ ] **0.3 — ~~Spike: Privy Expo end-to-end custody path~~ Deferred (2026-07-30), folded into 2.3/2.6**
  Decision: instead of a throwaway spike, the auth/wallet vendor is contained behind the `AuthProvider` / `WalletSession` seam (architecture §4.3b, §5.6), so a vendor failure discovered mid-build costs one adapter, not a rewrite. Custody-path validation moves into real tasks: 2.3 verifies a devnet transfer signed through the session port, 2.6 verifies the Phantom key-export round-trip. First Jupiter versioned-tx signature happens in 4.4 — accepted residual risk.

- [ ] **0.4 — ~~Spike: Jupiter swap with platform fee~~ Deferred (2026-07-31), folded into 4.3/4.4/4.6**
  Decision: swap mechanics live behind the `ChainAdapter` seam, and nothing before Phase 4 consumes this spike's outputs. Fee validation is absorbed into 4.4's real $2 mainnet test (fee-account balance assertion added); gasless strategy selection moves into 4.6. Design contingency noted for 4.3: most xStocks/GLDx are Token-2022 mints — if Jupiter platform fees misbehave on Token-2022 output, take the fee on the USDC input side instead. Founder decision still owed before 4.3: fee level (50 vs 100 bps, open question #4).

- [x] **0.5 — Spike: gold/silver mint selection** *(blocking open question #2)* → [decision](docs/spikes/gold-silver-mints/REPORT.md)
  Evaluate candidate mints (liquidity depth, issuer credibility, redemption, bridge risk) using Birdeye/Jupiter data.
  **Verify:** REPORT.md with a ranked table and an explicit decision: selected mints, or "ship stocks-only, gold fast-follow".

- [x] **0.6 — Price-data vendor selection** *(open question #5)* → [decision](docs/spikes/price-vendor/REPORT.md)
  Compare Birdeye vs Jupiter price API vs CoinGecko on: OHLC coverage for xStocks + chosen metal mints, rate limits, price freshness, cost at 100-asset scale.
  **Verify:** REPORT.md with the decision and a working sample script fetching price + 1D candles for AAPLx from the chosen vendor.

> **Gate:** legal opinion on jurisdictional posture (open question #1) is founder-owned and runs in parallel — it gates **launch**, not build. Do not pass Phase 4 → 5 without it resolved.

---

## Phase 1 — Backend core: API skeleton, auth, assets, prices (~2.5 weeks)

> Goal: a deployed API a mobile app can build against — auth, asset registry, live prices, charts.

- [x] **1.1 — `apps/api` skeleton**
  Fastify + `fastify-type-provider-zod`, Zod-validated env (`config/env.ts`, process exits on bad env), pino logger with redaction list, `/health` route, Dockerfile, two entrypoints (`index.ts`, `worker.ts` — worker is a no-op loop for now).
  **Verify:** `curl /health` returns `{data:{status:"ok"}}` locally and in Docker.

- [x] **1.2 — Prisma schema & migrations (full MVP schema)**
  All tables from architecture §4.4 (`users`, `wallets`, `assets`, `asset_stats`, `candles`, `watchlist_items`, `orders`, `deposits`, `position_lots`, `push_tokens`, `notifications`); DECIMAL for all money/quantity columns; `(chain, token_address)` unique; `users` keyed by `(auth_provider, provider_user_id)` — no vendor-named columns (vendor seam, §4.3b).
  **Verify:** `prisma migrate dev` from empty DB succeeds; seed script inserts 3 sample assets; a smoke test queries them back.

- [x] **1.3 — Auth middleware: `AuthProvider` port + Privy adapter + `POST /auth/session`** *(residual: positive-path with a real login token lands with 2.3's first app login)*
  `AuthProvider` interface (§4.3b) with the Privy adapter in `modules/auth/providers/privy/` (server SDK, keys cached); upsert `users` + `wallets` on first sight, attach `req.user`; per-IP and per-user rate limiting (Redis); lint rule blocks vendor SDK imports outside `providers/`.
  **Verify:** integration test — a real (test-app) Privy token creates a user row and returns a session; a forged token gets 401; hammering an endpoint gets 429; a mock second adapter passes the same integration suite (proves the seam).

- [x] **1.4 — Asset registry module + admin endpoints**
  CRUD under `/admin` (allowlist-token auth), public `GET /assets?category=&search=&cursor=` with pagination and status filtering (only `listed` visible).
  **Verify:** integration test — admin adds an asset, it appears in the public list; `paused` assets don't; search by name/ticker works.

- [x] **1.5 — Price poller worker + Redis cache**
  BullMQ scheduled job (5–15s, batched) hitting the chosen price vendor → upsert `asset_stats`, write `price:{assetId}` (TTL 60s), publish to `prices` pub/sub channel.
  **Verify:** with 3 seeded assets, `asset_stats.updated_at` stays ≤ 30s stale over a 5-minute run; Redis keys present.

- [x] **1.6 — Market endpoints: prices + candles**
  `GET /market/prices?ids=` (cache-first), candle-builder job (1m cadence + backfill-on-listing), `GET /market/:assetId/candles?interval=` for 1D/1W/1M/1Y/All.
  **Verify:** integration test — candles exist for every seeded asset in every interval; newly listed asset has backfilled candles within 5 min.

- [x] **1.7 — Watchlist module**
  `GET /watchlist`, `POST/DELETE /watchlist/:assetId`, PK `(user_id, asset_id)` idempotency.
  **Verify:** integration test — add, list, delete round-trip; double-add is a no-op, not an error.

- [x] **1.8 — WebSocket gateway**
  `WS /ws` with token auth; `prices` channel (subscribe by asset ids) and `user:{id}:events` channel; Redis pub/sub fan-out so multiple API instances work.
  **Verify:** test client sees a price tick ≤ 15s after connecting; unauthenticated socket is refused.

- [~] **1.9 — Deploy `api` + `worker` to staging** — *CI half done; deploy half blocked on hosting accounts*
  ✅ GitHub Actions CI (typecheck, lint, test on PR with Postgres 16 + Redis 7 services, migrations + seed). ✅ Fly config with two process groups + `release_command` migrations ([`fly.staging.toml`](fly.staging.toml)), deploy runbook ([`docs/deploy.md`](docs/deploy.md)). ⏸ Blocked: Fly + Neon/Upstash accounts (+ a **separate staging Privy app**), then Sentry.
  **Verify:** ✅ CI sequence proven against a fresh database (23 passed, 2 skipped) and red-blocks a failing test (exit 1). ⏸ Pending accounts: staging `/health` green; seeded asset shows a live price via the staging WS.

---

## Phase 2 — Mobile foundation: app shell, auth, wallet (~2.5 weeks)

> Goal: a user can install a dev build, sign up with email, see their wallet address, and export their key. (PRD Phase 1 scope.)

- [ ] **2.1 — `apps/mobile` skeleton**
  Expo dev-client + EAS config (`dev`/`staging`/`prod` variants), Expo Router with `(onboarding)` and `(main)` groups, NativeWind + dark-first design tokens in `src/theme/`, Sentry.
  **Verify:** EAS dev build installs and runs on a physical Android device; tab shell renders at 60fps (perf monitor).

- [ ] **2.2 — Typed API client + TanStack Query + MMKV persistence**
  `src/lib/api/` client generated over `packages/shared` schemas; QueryClient with MMKV persister; `<QueryBoundary>` wrapper enforcing loading/empty/error states.
  **Verify:** a demo screen lists staging assets with skeleton → data → airplane-mode error state, all three visibly designed.

- [ ] **2.3 — Auth onboarding flow (session port + Privy adapter)**
  `welcome → login` (email OTP, Google, Apple) → embedded wallet provisioned → `POST /auth/session` → land on Home. `WalletSession` port (§5.6) with the Privy adapter in `features/auth/providers/privy/`; `@privy-io/expo` import blocked elsewhere by lint rule.
  **Verify:** Maestro E2E — fresh install to authenticated Home in ≤ 60s; relogin on a second device shows the same wallet address (PRD 7.1 acceptance); a devnet transfer signed via `signTransaction` through the port lands on-chain (custody path validated — replaces spike 0.3).

- [ ] **2.4 — App lock (biometric/PIN gate)**
  Top-level overlay in `_layout.tsx`: cold start + foreground-after-N-minutes; `expo-local-authentication`; settings stored in secure store.
  **Verify:** manual test matrix on iOS + Android — lock triggers on cold start and background/foreground; cancel keeps content hidden.

- [ ] **2.5 — Wallet screen: address, QR, copy**
  `account/wallet.tsx` + `GET /wallet/deposit-info`; address with QR, copy-with-haptic, "Solana network only — USDC/USDT" warning copy.
  **Verify:** QR scanned by Phantom resolves to the correct address; copy button fills clipboard.

- [ ] **2.6 — Secret key export flow**
  `account/export-key.tsx` modal: fresh biometric auth → 3-step warning → key display on screenshot-blocked screen (`expo-screen-capture`), cleared on blur.
  **Verify:** exported key imports into Phantom and controls the same address (PRD 7.1 acceptance); screenshot attempt is blocked on Android; key never appears in logs.

- [ ] **2.7 — Logout & session hygiene**
  Logout clears Privy session, query cache, MMKV, secure store; returns to onboarding.
  **Verify:** after logout, relaunching the app shows onboarding and no residual data (inspect MMKV/secure store in dev menu).

---

## Phase 3 — Funding: deposits, balances, notifications (~1.5 weeks)

> Goal: PRD 7.2 complete — send USDC to the wallet, app knows within 15s, user gets a push.

- [ ] **3.1 — Helius webhook ingestion**
  `POST /webhooks/helius` (HMAC verified) → `parseIncomingTransfers` in the Solana adapter → upsert `deposits` (idempotent on `tx_signature`) → enqueue `deposit-confirm` job.
  **Verify:** integration test replays a recorded Helius payload twice — exactly one deposit row; bad HMAC → 401.

- [ ] **3.2 — Deposit confirmation worker + user events**
  `deposit-confirm` job polls confirmation → `status=confirmed` → publish `user:{id}:events` WS event.
  **Verify:** on staging, a real $1 USDC transfer flips to confirmed and a connected WS client receives the event ≤ 15s after on-chain confirmation.

- [ ] **3.3 — Push notifications (FCM/APNs)**
  `POST /devices` registration, `notifier` worker, deposit-confirmed push ("Your 50 USDC has arrived").
  **Verify:** staging deposit produces a push on a real Android and iOS device.

- [ ] **3.4 — Balances + buying power in-app**
  `getTokenBalances` via adapter (Redis cache 15s), Home header shows combined USDC+USDT buying power with breakdown; WS deposit event triggers refresh + in-app banner.
  **Verify:** Maestro E2E (mocked webhook): deposit → banner + balance update without app restart. Manual: real deposit reflected ≤ 15s.

- [ ] **3.5 — Guided "Fund your wallet" onboarding step**
  `(onboarding)/fund.tsx`: address + QR + network warning + live "waiting for deposit" state, skippable.
  **Verify:** new-user Maestro flow passes; funding screen detects the deposit and auto-advances with a success haptic.

---

## Phase 4 — Markets & trading (~3 weeks)

> Goal: PRD 7.3 + 7.4 complete — browse, chart, and actually buy/sell with fees attached, gasless.

- [ ] **4.1 — Markets tab: asset list + search + categories**
  Category tabs (Stocks / ETFs / Gold & Silver), live price + 24h change per row (WS-fed via `usePrice`), search, "New" badge for recently listed, watchlist star with haptic.
  **Verify:** Maestro — search "apple" finds AAPLx; adding an asset server-side makes it appear in-app within 5 min without an app update (PRD 7.3 acceptance).

- [ ] **4.2 — Asset detail: chart + stats**
  `markets/[assetId]`: victory-native XL Skia chart, 1D/1W/1M/1Y/All toggle, scrub with haptic ticks, price/change header, buy/sell CTA.
  **Verify:** chart scrubbing holds 60fps on a mid-range Android (Perf monitor recording attached to PR); all intervals render for every listed asset.

- [ ] **4.3 — Trade quote endpoint (`POST /trade/quote`)**
  Adapter `getQuote` (Jupiter + platform fee from 0.4), create `orders` row (`status=quoted`), Redis-cache quote (TTL 30s), return `{orderId, estTokens, priceImpact, fees, expiresAt}`; hard price-impact ceiling → error code.
  **Verify:** integration test — quote for $10 AAPLx returns sane fields; quote after 31s returns `QUOTE_EXPIRED`; a thin-liquidity mint trips the impact ceiling.

- [ ] **4.4 — Build & submit endpoints**
  `POST /trade/:orderId/build` → base64 unsigned tx (status=awaiting_signature); `POST /trade/:orderId/submit` → adapter submit, status=submitted, enqueue `trade-track`.
  **Verify:** integration test with a test keypair signs the built tx and submits on mainnet ($2); order reaches `submitted` with a tx signature; platform-fee account balance increases by the expected amount (absorbs deferred 0.4).

- [ ] **4.5 — Trade tracking worker + error taxonomy**
  `trade-track` polls with backoff (1s→60s); confirmed → write/consume `position_lots`, publish WS event + push; failed → mapped `error_code` (slippage / blockhash_expired / insufficient_funds / network).
  **Verify:** integration tests for confirm and each failure mapping (mock RPC); a real staging trade lands `confirmed` with a lot row.

- [ ] **4.6 — Gasless: select strategy + fee-payer integration** *(absorbs deferred 0.4; resolves open question #6)*
  Evaluate Privy fee sponsorship vs self-run fee payer vs Jupiter fee-payer options, pick one, and wire it so a wallet holding only USDC can trade.
  **Verify:** staging E2E — a fresh wallet with $10 USDC and **zero SOL** completes a buy (PRD 7.4 acceptance).

- [ ] **4.7 — Trade ticket UI (`trade/[assetId]` modal)**
  Amount keypad (USD-denominated) with haptics, buy/sell toggle, live quote refresh, pre-trade summary (est. tokens, price impact, fees, slippage guard), Zustand ticket store.
  **Verify:** Maestro — enter $25, see quote fields populate; expired quote silently re-quotes; amounts over balance disable confirm with `INSUFFICIENT_BALANCE` copy.

- [ ] **4.8 — Confirm → sign → status flow**
  SlideToConfirm (Reanimated + medium haptic) → Privy signs on device → submit → live status screen (submitted → confirmed) via `['order', orderId]` WS subscription with polling fallback → success animation + success haptic + explorer link; failure state with plain-English copy.
  **Verify:** staging E2E buy of $10 AAPLx completes ≤ 10s p50 over 10 runs (PRD acceptance); pulling the network mid-trade shows the failure state, funds untouched.

- [ ] **4.9 — Sell flow**
  Sell any held asset back to USDC; ticket pre-fills max from holdings.
  **Verify:** staging E2E — sell the AAPLx bought in 4.8; USDC balance increases; lot consumed.

- [ ] **4.10 — Biometric re-auth for large trades**
  Re-prompt above the user-configurable threshold (default from PRD 7.1).
  **Verify:** manual — trade above threshold prompts biometrics; below doesn't; threshold editable in Account.

---

## Phase 5 — Portfolio, history & polish (~2 weeks)

> Goal: PRD 7.5 + 7.6 — the app feels finished: P/L, activity, haptics pass, empty/error states, perf.

- [ ] **5.1 — Portfolio endpoint + screen**
  `GET /portfolio`: chain balances × cached prices, avg-cost P/L from `position_lots`; screen with total value, per-holding rows, pull-to-refresh (haptic).
  **Verify:** portfolio value matches on-chain balances × prices within 0.5% (scripted check against staging wallet); P/L correct for a scripted buy-buy-sell sequence (unit test on lot math).

- [ ] **5.2 — Activity feed**
  `GET /activity?cursor=`: merged deposits + trades, explorer links, pagination; `activity/[txId]` detail.
  **Verify:** every staging trade/deposit appears within 30s (PRD acceptance); explorer links resolve; pagination stable under new activity.

- [ ] **5.3 — Home screen assembly**
  Buying power header, watchlist section, movers, empty states for unfunded/new users.
  **Verify:** three user states screenshot-reviewed: brand new, funded-no-holdings, active trader — no blank screens anywhere.

- [ ] **5.4 — Haptics & animation pass**
  Audit every interaction against the haptic taxonomy (`haptics.ts` only — no ad-hoc calls); success/failure animations; micro-interactions.
  **Verify:** grep shows zero `expo-haptics` imports outside `haptics.ts`; taxonomy checklist in PR ticks every PRD 7.6 event.

- [ ] **5.5 — Error/empty/loading state audit**
  Sweep every query screen through `<QueryBoundary>`; kill any raw error strings; map all API error codes to friendly copy.
  **Verify:** airplane-mode walk of every screen shows designed states; unknown error code renders the generic fallback, not the raw code.

- [ ] **5.6 — Performance pass on mid-range Android**
  Profile list scroll + chart scrub on a real mid-range device; move any JS-thread hot spots to Reanimated/Skia; app cold-start budget.
  **Verify:** recorded profile shows 60fps scroll and scrub; cold start to interactive Home < 2.5s on the test device.

- [ ] **5.7 — Security & observability hardening**
  Rate-limit audit, Zod on every route (CI check), pino redaction verified, per-endpoint latency metrics dashboards, all on-chain interactions logged with tx signature.
  **Verify:** automated test posts malformed bodies to every route — all rejected with 400s; log sample shows no secrets; dashboard shows p50/p95 per endpoint.

---

## Phase 6 — Beta & launch readiness (~3 weeks)

- [ ] **6.1 — Analytics instrumentation**
  PostHog/Amplitude events for the full PRD §9 funnel (install → wallet → deposit → trade), fee-account volume attribution.
  **Verify:** a scripted fresh-user run appears as one coherent funnel in the analytics dashboard.

- [ ] **6.2 — E2E suite complete + CI gate**
  Maestro flows: onboarding, deposit-detect (mocked), buy, sell, key export — run on staging builds in CI.
  **Verify:** suite green on both platforms in CI; a deliberately broken flow blocks the pipeline.

- [ ] **6.3 — Geo-restriction & store compliance**
  Apply legal outcome (open question #1): app-store country availability list, store listings positioned as self-custody wallet + DEX interface.
  **Verify:** store metadata reviewed against the legal memo; prohibited jurisdictions excluded in both consoles.

- [ ] **6.4 — TestFlight / Play internal → closed beta (200 users)**
  Crash reporting triage rota, funnel review at 1 week; fix top-3 drop-offs.
  **Verify:** crash-free sessions ≥ 99.5% over the beta period; trade success rate ≥ 98%.

- [ ] **6.5 — Production cutover & launch checklist**
  Prod infra (separate DB/Redis/keys), on-call/alerting, fee account monitored, runbook for RPC/vendor outages.
  **Verify:** full smoke test on prod build: signup → deposit → buy → sell → export key, all green; alerts fire on a forced staging outage drill.
