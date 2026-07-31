/**
 * The auth/wallet vendor seam on mobile (architecture §5.6). Screens,
 * the trade flow and key export all consume this port; only
 * features/auth/providers/<vendor>/ may import a vendor SDK.
 */

export type SessionStatus = "loading" | "signed_out" | "ready";

export interface SessionUser {
  providerUserId: string;
  email: string | null;
}

/**
 * How a vendor surfaces key export.
 *
 * This is a capability descriptor rather than an `exportSecretKey():
 * Promise<string>` method, because not every vendor can hand back a raw
 * key. Privy's mobile SDKs deliberately cannot: the key is assembled on
 * a separate origin in a hosted page, so neither our app nor Privy can
 * read it. Modelling that as a string-returning call would have been a
 * lie the type system then spread through the app.
 */
export type KeyExport =
  | { kind: "unsupported"; reason: string }
  | { kind: "native" } // adapter can return the key directly
  | { kind: "webview"; url: string }; // open the vendor-hosted export page

export interface WalletSession {
  status: SessionStatus;
  user: SessionUser | null;
  /** Active Solana address, once the embedded wallet exists. */
  walletAddress: string | null;
  /** Bearer token for the Goldbag API; null when signed out. */
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  /** Signs a base64 transaction on device, returns it signed. */
  signTransaction: (txBase64: string) => Promise<string>;
  keyExport: KeyExport;
}

export type EmailLoginState =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "awaiting_code"; email: string }
  | { step: "verifying"; email: string }
  | { step: "error"; message: string };

export interface EmailLogin {
  state: EmailLoginState;
  sendCode: (email: string) => Promise<void>;
  submitCode: (code: string) => Promise<void>;
  reset: () => void;
}
