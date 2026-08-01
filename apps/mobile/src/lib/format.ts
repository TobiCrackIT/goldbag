/**
 * Money formatting. Amounts arrive as decimal strings and are formatted
 * with Intl — never `toFixed` on a parsed float (architecture §6).
 */
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return usd.format(n);
}

const percent = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

/**
 * Percent change with an explicit sign and arrow. In a monochrome system
 * these glyphs are the only direction signal, so they are not optional.
 */
export function formatPercentChange(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "•";
  return `${arrow} ${percent.format(value)}%`;
}

export function formatQuantity(value: string | number, decimals = 6): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(n);
}
