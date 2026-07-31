import {
  AuthTokenInvalidError,
  type AuthProvider,
} from "../../src/modules/auth/provider.js";

/**
 * Second AuthProvider implementation (besides Privy). Running the full
 * auth suite against it is the proof that the vendor seam holds — task
 * 1.3 verify. Token format: "mock:<providerUserId>[:<email>[:<address>]]".
 */
export function createMockAuthProvider(): AuthProvider {
  return {
    name: "mock",
    async verifyAccessToken(token: string) {
      const [scheme, providerUserId, email, address] = token.split(":");
      if (scheme !== "mock" || !providerUserId) {
        throw new AuthTokenInvalidError();
      }
      return {
        providerUserId,
        email: email || undefined,
        wallets: address ? [{ chain: "solana" as const, address }] : [],
      };
    },
  };
}
