import { PrivyClient } from "@privy-io/server-auth";
import {
  AuthTokenInvalidError,
  type AuthProvider,
  type VerifiedIdentity,
} from "../../provider.js";

/**
 * Privy adapter for the AuthProvider seam. Token signatures are verified
 * with Privy's per-app verification key (fetched once and cached by the
 * SDK); the linked-account lookup normalizes into VerifiedIdentity so
 * nothing downstream ever sees a Privy type.
 */
export function createPrivyAuthProvider(appId: string, appSecret: string): AuthProvider {
  const client = new PrivyClient(appId, appSecret);

  return {
    name: "privy",
    async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
      let userId: string;
      try {
        const claims = await client.verifyAuthToken(token);
        userId = claims.userId;
      } catch {
        throw new AuthTokenInvalidError();
      }

      const user = await client.getUser(userId);
      const wallets: VerifiedIdentity["wallets"] = [];
      let email: string | undefined;
      for (const account of user.linkedAccounts) {
        if (account.type === "wallet" && account.chainType === "solana") {
          wallets.push({ chain: "solana", address: account.address });
        } else if (account.type === "email") {
          email = account.address;
        } else if (account.type === "google_oauth") {
          email ??= account.email;
        }
      }
      return { providerUserId: userId, email, wallets };
    },
  };
}
