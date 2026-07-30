# Goldbag

**Robinhood-simple investing in real-world assets, with keys the user actually owns.**

Goldbag is a non-custodial mobile app (iOS + Android) that lets anyone with an email address and some USDC buy and sell tokenised real-world assets on Solana — starting with tokenised US stocks & ETFs (xStocks) and tokenised gold & silver.

## How it works

- **Sign up with email, Google, or Apple** — a [Privy](https://privy.io) embedded wallet gives every user a self-custodial Solana wallet with no seed phrase to manage. Keys are exportable at any time; Goldbag never holds them.
- **Fund with USDC/USDT** sent on Solana from any exchange or wallet. No fiat onramp in v1.
- **Buy and sell in USD terms** — trades route through the [Jupiter](https://jup.ag) aggregator with a platform fee attached, signed on-device, gasless (users never need SOL).
- **The backend is an index and a router, never a custodian.** Prices, charts, history, and P/L are all reconstructible from public chain data; balances always come from the chain.

## Status

**Pre-build (docs + planning stage).** No application code yet. Three de-risking spikes gate the build — see Phase 0 of [tasks.md](tasks.md).

## Documents

| Doc | Contents |
|---|---|
| [goldbag-prd.md](goldbag-prd.md) | Product requirements: goals, personas, P0/P1/P2 scope, risks, open questions |
| [goldbag-architecture.md](goldbag-architecture.md) | Backend + mobile architecture: data flows, storage, state management, dependencies |
| [tasks.md](tasks.md) | Phased build plan: 6 phases, 43 small tasks, each with a Verify criterion |

## Planned stack

| Layer | Tech |
|---|---|
| Mobile | React Native (Expo dev-client + EAS), Expo Router, TanStack Query, Zustand, NativeWind, victory-native XL (Skia charts), Reanimated |
| Auth & wallet | Privy embedded Solana wallets (client-side signing, key export) |
| Backend | Node.js + TypeScript, Fastify, Prisma, PostgreSQL, Redis, BullMQ |
| Chain | Solana mainnet · Helius (RPC + webhooks) · Jupiter (quotes/swaps + platform fee) |
| Monorepo | pnpm workspaces + Turbo — `apps/mobile`, `apps/api`, `packages/shared` (Zod contracts) |

## Workflow

One task = one branch = one commit (minimum). Branch from `main` as `task/<id>-<slug>`, merge when the task's **Verify** criterion passes. See the workflow rules at the top of [tasks.md](tasks.md).
