# Goldbag — Product Requirements Document

**Version:** 0.2 (Draft — switched app framework from Flutter to React Native)
**Date:** 2026-07-25
**Owner:** Oluwatobi
**Status:** For review

---

## 1. Overview

Goldbag is a non-custodial mobile app (React Native, iOS + Android) that lets anyone, anywhere buy and sell tokenised real-world assets (RWAs) on Solana — starting with tokenised US stocks/ETFs and tokenised gold & silver — with the onboarding simplicity of Robinhood and the self-custody of Phantom.

**One-liner:** *Robinhood-simple investing in real-world assets, with keys the user actually owns.*

**Positioning decisions (locked):**

| Decision | Choice |
|---|---|
| Custody & compliance model | Pure self-custody DEX front-end. Goldbag never holds user funds and performs no KYC. All trades settle on-chain from the user's own wallet. |
| Auth & wallet | Privy embedded wallets — email/social/phone login creates a self-custodial Solana wallet; user can export the secret key. |
| MVP asset classes | Tokenised stocks & ETFs (xStocks) + tokenised gold & silver. |
| Funding | USDC/USDT deposits only (send from an exchange or another wallet). No fiat onramp in MVP. |
| Stack | React Native (Expo) app · Node.js + TypeScript + PostgreSQL backend · Solana mainnet. |

---

## 2. Problem Statement

Most of the world cannot easily invest in US equities or precious metals: brokerage access is gated by geography, banking rails, minimum balances, and paperwork. Tokenised versions of these assets already trade permissionlessly on Solana (e.g., xStocks on Raydium/Jupiter), but reaching them today requires a crypto-native toolchain — seed phrases, DEX interfaces, slippage settings — that excludes exactly the mainstream user who needs the access most.

The cost of not solving this: the fast-growing RWA-on-Solana liquidity gets captured by DEX power users and aggregator front-ends, while the "global retail investor" segment — the largest addressable audience — has no product built for them. First movers in the consumer RWA-wallet category will own that audience.

---

## 3. Goals

**User goals**
1. A user with only an email address and some USDC can own a tokenised stock or gold within **5 minutes** of installing the app.
2. Users always retain self-custody: they can view their wallet address and export their secret key at any time.
3. Buying an asset feels as simple as Robinhood: pick asset → enter amount → slide/tap to confirm → haptic success.

**Business goals**
4. Reach **10,000 funded wallets** (wallets holding ≥ $10 of assets) within 90 days of public launch.
5. Generate revenue from day one via a **platform fee on swaps** (target 50–100 bps, configured through the swap aggregator's fee mechanism) — measurable as fee revenue per active trader.
6. Establish Goldbag as the default consumer front-end for RWAs on Solana before competing wallets add RWA-focused UX.

---

## 4. Non-Goals (v1)

1. **Fiat onramp / offramp.** MVP is stablecoin-funded only. Onramp (MoonPay/Onramper/local PSPs) is the first fast-follow, but it adds partner KYC and payments scope we deliberately defer.
2. **KYC / user identity.** Goldbag is a non-custodial interface; we collect no identity documents. (See Risks — some RWA issuers enforce their own restrictions.)
3. **Real estate & agriculture assets.** Live options on Solana are mostly permissioned/allowlisted with thin liquidity. Deferred to Phase 2 as partner integrations.
4. **Web app / desktop.** Mobile-only. The Moonshot-style experience is the product.
5. **Social / copy-trading features** (leaderboards, shared portfolios). Valuable later; noise for MVP.
6. **Limit orders, recurring buys (DCA), staking/yield.** Market orders only in v1; the architecture must not preclude these (see P2).
7. **Custodial convenience features** (account recovery beyond Privy's built-in flows, transaction reversal). Self-custody means self-custody.

---

## 5. Target Users & Personas

1. **"Locked-out investor" (primary).** 20–40, emerging market or non-US resident, holds stablecoins or can get them via P2P/local exchange, wants exposure to US stocks and gold but has no brokerage access. Comfort with crypto: low–medium.
2. **"Crypto-native diversifier" (secondary).** Already uses Phantom/Jupiter, wants a clean dedicated app for the RWA slice of their portfolio and the ability to hold keys.
3. **"Gold saver" (secondary).** Uses gold as an inflation hedge/savings vehicle; cares about buying small amounts frequently, not trading.

---

## 6. User Stories

**Onboarding & wallet**
- As a first-time user, I want to sign up with just my email or Google/Apple account so that I get a wallet without ever seeing a seed phrase.
- As a user, I want to view my wallet address (with QR code) so that I can receive USDC/USDT from an exchange.
- As a user, I want to export my secret key after passing biometric/PIN verification so that I truly own my funds and can import them into another wallet.
- As a returning user, I want to log in with biometrics so that opening the app is instant but still protected.

**Funding**
- As a new user, I want a guided "Fund your wallet" flow that shows my deposit address, warns me to send only USDC/USDT on Solana, and notifies me the moment the deposit lands, so that I don't lose funds to a wrong-network transfer.
- As a user, I want to see my available buying power (USDC + USDT balances) at the top of the app so that I always know what I can invest.

**Discover & watch**
- As a user, I want to browse assets grouped by category (Stocks, ETFs, Gold & Silver) with live prices and 24h change so that I can find what to buy.
- As a user, I want to search assets by name or ticker so that I can jump straight to Apple or Tesla.
- As a user, I want to favourite assets into a watchlist so that my home screen shows what I care about.
- As a user, I want to view a price chart (1D/1W/1M/1Y/All) with the current price and change so that I can time my decision.
- As a user, I want newly listed assets to appear automatically with a "New" badge so that I discover them without updating the app.

**Trade**
- As a user, I want to buy an asset by entering a USDC amount (e.g., $25 of AAPLx) so that I think in money, not token quantities.
- As a user, I want to sell any holding back to USDC so that I can take profit or exit.
- As a user, I want a clear pre-trade summary (amount, estimated tokens, price impact, fees) and a confirm gesture with haptic feedback so that I never trade by accident.
- As a user, I want to see the live status of my trade (submitted → confirmed) and a success animation so that I trust the trade happened.
- As a user, if a trade fails (slippage, network congestion), I want a plain-English error and my funds untouched so that I'm never left confused about my money.

**Portfolio**
- As a user, I want a portfolio screen showing total value, per-asset holdings, and profit/loss so that I can track performance at a glance.
- As a user, I want a history of my deposits, buys, and sells with links to the Solana explorer so that everything is verifiable on-chain.

**Account**
- As a user, I want to log out, and log back in on a new device with the same email, and find the same wallet and balances, so that my account is portable.

---

## 7. Requirements

### P0 — Must-Have (MVP cannot ship without)

**7.1 Auth & embedded wallet (Privy)**
- Sign up / login via email OTP, Google, and Apple. Privy provisions a self-custodial embedded Solana wallet on first login.
- Biometric/PIN app lock; required again for: secret key export, and any transaction above a user-configurable threshold.
- Wallet screen: address display, copy, QR code; secret key export gated behind biometric + explicit multi-step warning.
- Logout clears all local key material and session tokens.
- *Acceptance:* new user reaches a funded-wallet-ready state (address visible) in ≤ 60 seconds; key export round-trips into Phantom successfully; login on a second device restores the same wallet address.

**7.2 Funding (USDC/USDT deposits)**
- Deposit screen with address + QR, explicit "Solana network only" warning, and supported-token list (USDC, USDT).
- Backend watches the wallet address and pushes a notification + in-app banner when a deposit is confirmed.
- Balances refresh in real time on the home screen (USDC + USDT shown as combined buying power with a breakdown).
- *Acceptance:* a USDC transfer to the address is reflected in-app within 15 seconds of on-chain confirmation; a push notification is delivered.

**7.3 Asset catalogue & market data**
- Backend-managed asset registry (PostgreSQL): mint address, symbol, name, category (Stock / ETF / Gold & Silver), logo, status (listed/delisted/paused). New assets are added server-side and appear in-app without an app release.
- Live prices, 24h change, and OHLC chart data (1D/1W/1M/1Y/All) served by the backend, sourced from an aggregator price API (Birdeye or Jupiter price API — engineering to select) and cached.
- Search by name/ticker; category tabs; watchlist (favourites) persisted server-side per account.
- *Acceptance:* all listed assets show a price ≤ 30s stale; charts render for every listed asset; adding an asset in the admin registry makes it visible in-app within 5 minutes.

**7.4 Trading (swap engine)**
- Buy: USDC (or USDT) → asset token; Sell: asset token → USDC. Routed through the Jupiter swap aggregator API (which includes Raydium liquidity) with a platform fee configured via Jupiter's fee mechanism.
- Pre-trade quote screen: input amount in USD, estimated tokens received, price impact, total fees, and a max-slippage guard (sane default, e.g. 1%; trade aborts rather than fills beyond it).
- Transactions are signed client-side by the Privy embedded wallet — private keys never touch Goldbag servers.
- Trade lifecycle UI: quote → confirm (slide-to-confirm with haptic) → submitted → confirmed/failed, with explorer link.
- All failures produce a user-readable message; funds are never debited on a failed swap (atomic on-chain behavior surfaced honestly).
- If the user's wallet lacks SOL for fees, handle it invisibly (fee sponsorship / gasless relay via Privy or a fee-payer service) — **users must never need to buy SOL to trade**.
- *Acceptance:* end-to-end buy of $10 AAPLx completes in ≤ 10s p50; quoted-vs-executed price within slippage bound in 100% of fills; a user with zero SOL can complete a trade.

**7.5 Portfolio & history**
- Portfolio screen: total value (USD), per-holding rows (quantity, value, P/L since acquisition), pull-to-refresh.
- Activity feed: deposits, buys, sells; each row links to the transaction on a Solana explorer.
- Cost basis computed server-side from observed fills (average cost method).
- *Acceptance:* portfolio value matches on-chain balances × current prices within 0.5%; every trade appears in history within 30s.

**7.6 Design & UX quality bar (Moonshot-grade)**
- **Monochrome design system** (updated 2026-07-31): black, white and true neutral greys only — no hues anywhere. Supports **both light and dark** appearance, following the device setting; the two are inversions of one palette, so no screen branches on theme. Price direction is signalled by sign, arrow and weight — never by colour — so gains/losses read correctly for colour-blind users and in greyscale.
- 60fps scrolling and chart interaction on mid-range Android (use Reanimated + Skia-based charts; keep heavy work off the JS thread).
- Haptic feedback on: confirm gestures, trade success/failure, favouriting, pull-to-refresh.
- Every data screen has designed loading, empty, and error states — no blank screens, no raw error strings.
- Checkout-critical flows usable one-handed on small screens (≥ 360px width).

**7.7 Backend & platform (Node.js/TypeScript/PostgreSQL)**
- Services: auth/session (Privy token verification), asset registry + price cache, deposit watcher, trade/quote proxy (server-side Jupiter integration for fee attribution + analytics), portfolio indexer, push notifications (FCM/APNs).
- No custody: the backend never stores private keys or signs user transactions.
- Observability: structured logging, error tracking, per-endpoint latency metrics; all on-chain interactions logged with tx signature.
- Security: rate limiting, input validation on every endpoint, secrets in a secret manager, no PII beyond email.

### P1 — Nice-to-Have (fast follows)

- **Price alerts** on watchlist assets (push notification at target price).
- **In-app news/context** per asset (e.g., simple description, market cap, underlying-asset explainer).
- **USDT⇄USDC in-app conversion** so buying power is fully fungible.
- **Referral program** (share link, both sides get fee discount).
- **Localised app** (first languages driven by launch-market analytics).
- **Withdraw/send** flow to external addresses from within the app (MVP users can export the key instead, but native send improves trust).

### P2 — Future Considerations (design for, don't build)

- **Fiat onramp/offramp** (MoonPay/Onramper/local PSPs) — the funding screen should be designed as a hub with room for "Card / Bank" methods.
- **Real estate & agriculture assets** via issuer partnerships — the asset registry schema must support allowlist-gated assets and per-asset trade eligibility rules.
- **Limit orders & recurring buys (DCA)** — the trade service API should be order-shaped (intent + execution), not swap-shaped, to allow these later.
- **Yield on idle stablecoins** (regulatory review required).
- **Multi-chain expansion** (asset registry keyed by chain+mint, not mint alone).

---

## 8. System Architecture (summary)

```
React Native app (iOS/Android, Expo)
 ├─ Privy Expo SDK ── auth + embedded Solana wallet (client-side signing, key export)
 ├─ Goldbag API (Node.js/TS) ── REST/WebSocket
 │    ├─ PostgreSQL: users, asset registry, watchlists, indexed trades, cost basis
 │    ├─ Price service: Birdeye/Jupiter price API → cache (Redis) → app
 │    ├─ Quote/trade service: Jupiter swap API (platform fee attached)
 │    ├─ Deposit watcher + portfolio indexer: Solana RPC/webhook provider (e.g. Helius)
 │    └─ Notifications: FCM/APNs
 └─ Solana mainnet ── xStocks + gold/silver token mints, Raydium/Jupiter liquidity
```

Key principle: **the backend is an index and a router, never a custodian.** Everything it does (prices, quotes, history) could be reconstructed from the chain; user funds are only ever controlled by the user's Privy wallet.

---

## 9. Success Metrics

**Leading (first 30 days)**
- Install → wallet created: ≥ 70%
- Wallet created → first deposit ≥ $10: ≥ 25% (this is the funnel's hardest step with no onramp — instrument it heavily)
- First deposit → first trade within 24h: ≥ 60%
- Trade success rate (submitted → confirmed): ≥ 98%
- Crash-free sessions: ≥ 99.5%

**Lagging (90 days)**
- 10,000 funded wallets; $2M cumulative trading volume
- 30-day retention of funded users: ≥ 35%
- Fee revenue per funded wallet per month (target set after fee-tier decision)
- Organic share: ≥ 20% of installs from referral/word-of-mouth

Measurement: product analytics (e.g., PostHog/Amplitude) + on-chain volume attribution via the platform-fee account. Evaluate at 2 weeks, 30 days, 90 days post-launch.

---

## 10. Risks & Mitigations

1. **Issuer-level restrictions on RWAs (highest risk).** xStocks tokens are issued by a regulated issuer (Backed) whose terms restrict certain jurisdictions (incl. the US), even though secondary DEX trading is technically permissionless. A no-KYC front-end may still face app-store rejection or legal exposure for facilitating access. → *Mitigation:* obtain legal opinion before launch; likely outcome is geo-restricting app-store availability in prohibited jurisdictions while remaining KYC-free elsewhere. Treat as a launch blocker to resolve, not an afterthought.
2. **Gold/silver sourcing on Solana is thin.** Natively-issued, liquid gold/silver tokens on Solana are limited; bridged PAXG/XAUT adds bridge risk. → *Mitigation:* engineering spike (see Open Questions) to select mints by liquidity + issuer credibility; ship stocks-only if nothing meets the bar, with gold as fast-follow.
3. **App-store policy.** Apple/Google scrutinise crypto trading apps. → *Mitigation:* position as self-custody wallet + DEX interface (precedent: Phantom, Moonshot, Jupiter mobile); no in-app fiat purchases avoids IAP conflicts.
4. **No-onramp funding friction.** Requiring users to already hold USDC caps growth. → *Mitigation:* accept for MVP (validates trading UX with crypto-adjacent users), prioritise onramp as the #1 post-launch item.
5. **Liquidity/price-impact on small caps.** Some xStocks pairs are thin; naive market orders could fill badly. → *Mitigation:* hard price-impact ceiling with a clear warning; hide/pause assets whose liquidity falls below a threshold.
6. **Privy dependency.** Auth + custody UX rides on one vendor. → *Mitigation:* key export guarantees user exit; abstract the wallet layer in the app so a migration (e.g., to Turnkey) is contained.

---

## 11. Open Questions

**Blocking (answer before build starts)**
1. **Legal:** confirm the jurisdictional posture for a no-KYC front-end to xStocks (which countries to geo-block at app-store level). *(Owner: founder + counsel)*
2. **Engineering:** select the gold/silver mints (evaluate liquidity, issuer, redemption) — or explicitly launch stocks/ETFs-only. *(Owner: engineering spike, 3 days)*
3. **Engineering:** spike the Privy Expo SDK end-to-end (email/social login → embedded Solana wallet → sign a Jupiter swap → key export) to validate the full custody path before UI build-out. *(Owner: engineering spike, 1–2 days)*

**Non-blocking (resolve during build)**
4. Fee level (50 vs 100 bps) and whether USDT trades route through USDC first. *(Owner: founder)*
5. Price/chart data vendor: Birdeye vs. Jupiter price API vs. CoinGecko — cost, rate limits, OHLC coverage. *(Owner: engineering)*
6. Gasless strategy: Privy-native fee sponsorship vs. self-run fee payer vs. Jupiter's fee-payer options. *(Owner: engineering)*
7. Analytics stack and event taxonomy. *(Owner: product)*
8. Brand: is "Goldbag" the launch name (trademark/app-store availability)? *(Owner: founder)*

---

## 12. Timeline & Phasing (suggested)

| Phase | Scope | Duration |
|---|---|---|
| **0 — Spikes & legal** | Open questions 1–3; Figma design of core flows (Moonshot-style) | 2 weeks |
| **1 — Wallet & funding** | Privy auth, wallet screens, key export, deposits, balances, push | 3 weeks |
| **2 — Markets & trading** | Asset registry, prices/charts, watchlist, buy/sell via Jupiter, gasless | 4 weeks |
| **3 — Portfolio & polish** | Portfolio, history, P/L, haptics pass, empty/error states, perf | 2 weeks |
| **4 — Beta** | TestFlight/Play internal → closed beta (200 users), fix funnel drop-offs | 3 weeks |
| **Launch** | Public launch in cleared jurisdictions | — |

~14 weeks to public launch. Onramp (P1→P0 promotion) is the first post-launch cycle.

---

## 13. Assumptions Log

- Solana mainnet only; single-chain for MVP.
- Revenue = swap platform fee via Jupiter fee mechanism (no subscription, no spread markup beyond the fee).
- English-only at launch.
- Backend hosted on a managed platform (Railway/Render/Fly) + managed Postgres; Helius (or similar) for RPC/webhooks.
- Moonshot is the UX benchmark for *interaction*: card-based asset lists, big price charts, slide-to-confirm trades, pervasive haptics. The palette is deliberately not Moonshot's — Goldbag is monochrome, light and dark (see 7.6).
