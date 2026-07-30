# Spike 0.6 — Price/Chart Data Vendor Selection

**Date:** 2026-07-30
**Resolves:** PRD open question #5
**Decision:** **Jupiter Price API v3 for live prices; candles built in-house from our own tick stream; GeckoTerminal (CoinGecko on-chain) for one-time backfill on listing. Birdeye not adopted for MVP.**
**Working sample:** [`sample.mjs`](sample.mjs) — fetches AAPLx live price (Jupiter) + 1D candles (GeckoTerminal) with zero keys and zero dependencies.

## What was tested live (2026-07-30)

| Probe | Result |
|---|---|
| Jupiter `price/v3` for AAPLx | ✅ Works keyless on `lite-api.jup.ag`. Returns on-chain price, 24h change, liquidity, **and `stockData` — the official underlying AAPL equity price** (332.32 on-chain vs 331.14 underlying at test time). |
| GeckoTerminal pools + daily OHLCV for AAPLx | ✅ Works keyless. Full o/h/l/c/v history per pool; minute/hour/day timeframes. |
| CoinGecko native `simple/token_price` (Solana contract) | ✅ Works keyless — AAPLx is indexed (333.15, −2.58%). But per-coin OHLC needs CoinGecko coin IDs (spotty for long-tail xStocks) and the free Demo plan caps at **10,000 calls/month** — unusable for live polling. |
| Birdeye `defi/price` | ❌ `Unauthorized` — every endpoint requires a key. Docs confirm OHLCV endpoints exist, but **batch/multi endpoints are gated to the Business package** — the exact capability a 100-asset poller needs. |

## Comparison at our workload (100 assets, 5–15s poll, PRD ≤30s staleness)

| | Jupiter Price v3 | Birdeye | CoinGecko (native) | GeckoTerminal (CG on-chain) |
|---|---|---|---|---|
| Live price freshness | Per-block DEX price | Good | Aggregated, minutes lag | Pool-level, ~10–20s lag |
| Batch support | ✅ ~50 mints/call → 2 calls per poll cycle | Gated to Business tier | 100+ contracts/call but monthly cap kills it | Per-pool |
| OHLC coverage for xStocks + metals | ❌ none | ✅ per token | Partial (needs coin IDs) | ✅ per pool, any pair we trade |
| Rate limit (entry tier) | 600 req/min free — we need ~12 | Key + CU-metered, paid tiers | 10k calls/**month** free | 30 calls/min free, no monthly cap |
| Cost at our scale | **$0** (headroom: paid portal tiers exist) | ~$99–699/mo + batch tier gating | $129+/mo to be viable | **$0** |
| Strategic fit | Same vendor as swap execution — displayed price and quoted price agree; `stockData` gives us underlying-vs-onchain premium for free | Best pure data product, wrong cost shape for MVP | Wrong shape (coin-ID world, monthly caps) | Perfect for backfill, not for 5s polling |

## The decision, concretely

1. **Live prices (task 1.5):** price-poller calls Jupiter `price/v3` with batched mint ids every 5–15s (2 calls/cycle for 100 assets — 2% of the free rate limit). Store `usdPrice`, `priceChange24h`, `liquidity`, and `stockData.price` (underlying reference) into `asset_stats`.
2. **Candles (task 1.6, amended):** the candle-builder **derives 1m candles from our own poller ticks** and rolls them up to 15m/1h/1d — no vendor OHLC on the hot path, no per-asset rate-limit multiplication, works identically for every asset we ever list.
3. **Backfill on listing (task 1.6):** one-time GeckoTerminal OHLCV pull (day + hour + minute) for the asset's deepest pool so charts aren't empty on day one. A few calls per newly listed asset, well inside the free 30/min limit.
4. **Chart caveat to carry into product:** DEX-pool candles reflect on-chain trading (24/7, thin weekends), not NASDAQ sessions. The `stockData` reference price lets us optionally overlay/blend the official equity line later — a P1 polish decision, not an MVP blocker.
5. **Birdeye stays the named fallback** if Jupiter price quality degrades or we outgrow self-built candles; budget ~$99–199/mo when that day comes. Revisit trigger: >250 listed assets or observed price staleness breaching the 30s PRD bar.

### Risk notes
- `lite-api.jup.ag` free tier limits could tighten — mitigation: the paid Jupiter portal is a drop-in (same API, key added), and our poll volume is tiny.
- GeckoTerminal is backfill-only; if it disappears, charts start empty for newly listed assets until our own ticks accumulate — degraded, not broken.
- Self-built candles must be idempotent across poller restarts (build from stored ticks, not in-memory state) — noted for task 1.6 implementation.

## Sources

- Live probes: `lite-api.jup.ag/price/v3`, `api.geckoterminal.com` (see method in [`sample.mjs`](sample.mjs)), `api.coingecko.com`, `public-api.birdeye.so`, all 2026-07-30.
- [Jupiter Developer Portal — pricing/rate limits](https://developers.jup.ag/pricing) · [rate limits](https://developers.jup.ag/docs/portal/rate-limits)
- [CoinGecko API pricing plans](https://www.coingecko.com/en/api/pricing) · [public plan rate limit](https://support.coingecko.com/hc/en-us/articles/4538771776153-What-is-the-rate-limit-for-CoinGecko-API-public-plan)
- [Birdeye docs — data accessibility by package](https://docs.birdeye.so/docs/data-accessibility-by-packages)
