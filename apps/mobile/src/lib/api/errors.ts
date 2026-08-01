import type { ErrorCode } from "@goldbag/shared";

/**
 * The one place API error codes become words a user reads (PRD 7.6: no
 * raw error strings, ever). Adding a code to the shared enum without
 * adding copy here is a type error, which forces the copy conversation.
 */
const COPY: Record<ErrorCode, { title: string; message: string }> = {
  QUOTE_EXPIRED: {
    title: "Price moved",
    message: "That quote expired. We'll get you a fresh price.",
  },
  SLIPPAGE_EXCEEDED: {
    title: "Price moved too much",
    message: "The price changed more than your limit, so we stopped the trade. Nothing was spent.",
  },
  PRICE_IMPACT_TOO_HIGH: {
    title: "Not enough liquidity",
    message: "This trade would move the price too much. Try a smaller amount.",
  },
  INSUFFICIENT_BALANCE: {
    title: "Not enough funds",
    message: "You don't have enough for this trade. Add funds and try again.",
  },
  BLOCKHASH_EXPIRED: {
    title: "Trade timed out",
    message: "The network took too long to confirm. Nothing was spent — try again.",
  },
  NETWORK_CONGESTION: {
    title: "Network is busy",
    message: "Solana is congested right now. Give it a moment and try again.",
  },
  ASSET_NOT_TRADABLE: {
    title: "Unavailable",
    message: "This asset can't be traded right now.",
  },
  VALIDATION_ERROR: {
    title: "Something looks off",
    message: "We couldn't process that request. Please try again.",
  },
  UNAUTHORIZED: {
    title: "Please sign in",
    message: "Your session expired. Sign in again to continue.",
  },
  FORBIDDEN: {
    title: "Not allowed",
    message: "You don't have access to this.",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "We couldn't find what you were looking for.",
  },
  RATE_LIMITED: {
    title: "Slow down",
    message: "Too many requests. Wait a moment and try again.",
  },
  INTERNAL: {
    title: "Something went wrong",
    message: "That's on us. Please try again in a moment.",
  },
};

const OFFLINE = {
  title: "No connection",
  message: "Check your internet connection and try again.",
};

const UNKNOWN = {
  title: "Something went wrong",
  message: "Please try again in a moment.",
};

/** Thrown by the API client; carries a code the UI maps to copy. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Network-level failure (no response) — distinct from an API error code. */
export class NetworkError extends Error {
  constructor(message = "network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export function errorCopy(error: unknown): { title: string; message: string } {
  if (error instanceof NetworkError) return OFFLINE;
  if (error instanceof ApiError) return COPY[error.code] ?? UNKNOWN;
  return UNKNOWN;
}
