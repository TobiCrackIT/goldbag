import type { ChainId } from "@goldbag/shared";

/**
 * The auth/wallet vendor seam (architecture §4.3b). This is the entire
 * backend↔vendor surface: verify a bearer token, return a normalized
 * identity. Vendor SDK imports are allowed only inside
 * `modules/auth/providers/<vendor>/` — enforced by eslint.
 */
export interface VerifiedIdentity {
  providerUserId: string;
  email?: string;
  wallets: { chain: ChainId; address: string }[];
}

export class AuthTokenInvalidError extends Error {
  constructor(message = "invalid or expired access token") {
    super(message);
    this.name = "AuthTokenInvalidError";
  }
}

export interface AuthProvider {
  readonly name: string;
  /** Resolves for a valid token; throws AuthTokenInvalidError otherwise. */
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}
