#!/usr/bin/env node
/**
 * Spike 0.6 sample — fetch live price + 1D candles for AAPLx using the
 * chosen vendors: Jupiter Price API v3 (live prices, batched) and
 * GeckoTerminal (CoinGecko on-chain) OHLCV (candle backfill).
 * Zero dependencies, zero API keys. Node 22+.
 *
 *   node sample.mjs
 */

const AAPLX_MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";
const NETWORK = "solana";

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// --- 1. Live price: Jupiter Price API v3 (batch up to ~50 ids per call) ---
const prices = await getJson(`https://lite-api.jup.ag/price/v3?ids=${AAPLX_MINT}`);
const p = prices[AAPLX_MINT];
if (!p) throw new Error("Jupiter returned no price for AAPLx");
console.log("AAPLx on-chain price:  $" + p.usdPrice.toFixed(2));
console.log("24h change:            " + p.priceChange24h.toFixed(2) + "%");
if (p.stockData) {
  // Jupiter includes the official underlying equity reference price for xStocks
  console.log("Underlying AAPL price: $" + p.stockData.price.toFixed(2) + ` (as of ${p.stockData.updatedAt})`);
}

// --- 2. 1D candles: GeckoTerminal OHLCV on the deepest AAPLx pool ---
const poolsRes = await getJson(
  `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/tokens/${AAPLX_MINT}/pools?page=1`,
);
const pools = poolsRes.data ?? [];
if (pools.length === 0) throw new Error("GeckoTerminal returned no pools for AAPLx");
const topPool = pools.reduce((a, b) =>
  Number(a.attributes.reserve_in_usd) >= Number(b.attributes.reserve_in_usd) ? a : b,
);
const poolAddress = topPool.id.replace(`${NETWORK}_`, "");
console.log(`\nDeepest pool: ${topPool.attributes.name} (${poolAddress})`);
console.log(`Pool reserve: $${Number(topPool.attributes.reserve_in_usd).toLocaleString()}`);

const ohlcvRes = await getJson(
  `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${poolAddress}/ohlcv/day?limit=7`,
);
const candles = ohlcvRes.data?.attributes?.ohlcv_list ?? [];
if (candles.length === 0) throw new Error("GeckoTerminal returned no candles");
console.log("\nLast 7 daily candles (UTC):");
console.log("date        open     high     low      close    volume");
for (const [ts, o, h, l, c, v] of candles) {
  const d = new Date(ts * 1000).toISOString().slice(0, 10);
  console.log(
    `${d}  ${o.toFixed(2).padStart(7)}  ${h.toFixed(2).padStart(7)}  ${l.toFixed(2).padStart(7)}  ${c.toFixed(2).padStart(7)}  ${Math.round(v).toLocaleString().padStart(8)}`,
  );
}
console.log("\nOK: price via Jupiter v3, 1D candles via GeckoTerminal.");
