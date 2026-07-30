# Spike 0.5 — Gold & Silver Mint Selection

**Date:** 2026-07-30
**Resolves:** PRD open question #2 (blocking)
**Decision:** **Ship gold at launch (GLDx + XAUt0). No silver at launch — fast-follow behind a liquidity trigger. PAXG added after a 60-day liquidity watch.**

## Method

Candidates were enumerated via Jupiter's token search API (verified tokens only), then evaluated on four axes from the task spec: liquidity depth, issuer credibility, redemption, bridge risk. Liquidity depth was measured the way our users will experience it — actual Jupiter quote API price impact for USDC→token at $25 / $100 / $1,000 / $5,000 — not just pooled TVL. All figures collected live on 2026-07-30.

## Gold — ranked

| # | Token | Mint | Issuer | On Solana via | DEX liquidity | 24h DEX vol | Holders | Impact @$100 | @$1k | @$5k | Call |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **GLDx** (Gold xStock, tokenised SPDR GLD) | `Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re` | Backed (xStocks) | Native SPL (Token-2022) | $110k | $331k | 5,021 | 0.00% | 0.00% | 0.00% | **List at launch** |
| 2 | **XAUt0** (Tether Gold) | `AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P` | Tether (ops: Everdawn Labs) | LayerZero OFT (Oct 2025) | $284k | $856k | 5,420 | 0.00% | 0.00% | 0.05% | **List at launch** |
| 3 | **PAXG** (Pax Gold) | `5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW` | Paxos (NYDFS-regulated) | Official deployment, 2026-06-25 | $447k | $693k | 234 | 0.12% | 0.14% | 0.15% | **60-day watch, then list** |
| 4 | VNXAU (VNX Gold) | `9TPL8droGJ7jThsq4momaoz6uhTcvX2SeMqipoPmNa8R` | VNX (Liechtenstein) | Native | $62k | $8k | 1,727 | — | — | — | Pass: liquidity too thin |
| 5 | GOLD (ORO) | `GoLDppdjB1vDTPSGxyMJFqdnj134yH6Prg9eqsGDiw6A` | ORO (startup, unproven) | Native | $390k | — | 9,774 | — | — | — | Pass: issuer credibility bar not met |
| 6 | PAXG (Wormhole-bridged) | `C6oFsE8nXRDT…` | — | Wormhole | **$257** | $456 | 1,495 | — | — | — | Pass: dead — validates the bridged-asset concern |

**Why GLDx first.** It rides the exact rails we already integrate: same issuer (Backed), same `xstocks` token standard, same legal/jurisdictional posture as every stock we list — zero incremental issuer risk or legal surface. Execution quality is the best measured (0.00% impact through $5,000). Nuance to carry into product copy: it tokenises shares of the GLD ETF (gold *exposure*), not a direct metal claim.

**Why XAUt0 second.** Direct metal-denominated claim with the deepest organic DEX activity ($856k/day) and the Tether brand — which is precisely the brand our USDT-holding target users in Africa/LatAm already trust. Risks logged: LayerZero OFT dependency (underlying issuance sits on Ethereum; Everdawn Labs operates the omnichain layer), freeze authority on the mint, and physical redemption minimums (full-bar scale) that are irrelevant to our retail users in practice.

**Why PAXG is a watch, not a launch listing.** Strongest issuer on paper (NYDFS-regulated, ~half the ~$6B tokenised-gold market together with XAUT) and the deepest pool ($447k) — but the Solana deployment is 5 weeks old, has 234 holders, and prices ~12–15 bps worse than the other two at every size we tested. List it once depth and pricing hold for 60 days; it then becomes the "regulated issuer" option in the catalogue.

## Silver — do not ship at launch

| Token | Issuer | DEX liquidity | Impact @$100 | @$1k | Verdict |
|---|---|---|---|---|---|
| SLVx (iShares Silver xStock) | Backed | **$30** | no route | no route | Untradable on DEX despite $8.6M mcap (supply sits on CEXs) |
| SLVon (iShares Silver, Ondo) | Ondo | $47k | 0.61% | **4.73%** | A $1k buy loses ~$47 to impact — fails any honest execution bar |

No credible native silver metal token exists on Solana. **Decision: launch "Gold" only; rename the category or keep "Gold & Silver" with silver marked "coming soon".**

**Silver fast-follow trigger (mechanical, no re-spike needed):** list a silver mint when it sustains ≥ $250k pooled DEX liquidity **and** < 0.5% Jupiter price impact on a $1,000 buy for 30 consecutive days. The price-poller already collects `liquidity_usd` per asset — add silver candidates to the registry as `paused` and let the data flip the decision.

## Consequences for the build

1. Asset registry seeds (Phase 1): GLDx + XAUt0 with category `gold_silver`, status `listed`; PAXG + SLVx + SLVon as `paused` (monitored, invisible to users).
2. The measured impact numbers justify the PRD's hard price-impact ceiling; suggest defaulting it to 100 bps with the existing abort behavior.
3. XAUt0's freeze authority and LayerZero dependency go into the risk register; if either bites, GLDx alone still carries the gold story.

## Sources

- Live data: Jupiter token search + quote APIs (`lite-api.jup.ag`), 2026-07-30.
- [Tether-linked USDT0 and XAUT0 launch on Solana via LayerZero tech — The Block](https://www.theblock.co/post/374786/tether-linked-usdt0-and-xaut0-launch-on-solana-via-layerzero-tech)
- [Paxos launches PAXG on Solana — Blockchain.News](https://blockchain.news/news/paxos-paxg-solana-launch)
- [What is tokenized gold? PAXG, XAUT in 2026 — BeInCrypto](https://beincrypto.com/learn/tokenized-gold/)
