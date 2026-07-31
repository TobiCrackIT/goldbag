import { useCallback, useMemo, type ReactNode } from "react";
import Constants from "expo-constants";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import {
  PrivyProvider,
  getAccessToken,
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  usePrivy,
  isConnected,
} from "@privy-io/expo";
import { SessionContext } from "../../session/context";
import type { EmailLogin, KeyExport, WalletSession } from "../../session/types";
import { useEmailLoginState } from "./useEmailLoginState";

/**
 * Privy adapter for the WalletSession port. This directory is the only
 * place in the app allowed to import @privy-io/* (eslint-enforced,
 * architecture §5.6).
 */

const extra = Constants.expoConfig?.extra ?? {};
const APP_ID = extra.privyAppId as string | undefined;
const CLIENT_ID = extra.privyClientId as string | undefined;
const KEY_EXPORT_URL = extra.keyExportUrl as string | undefined;

/**
 * Privy's mobile SDKs have no key-export method by design: the key is
 * assembled on a separate origin inside a hosted page so neither our app
 * nor Privy can read it. We therefore advertise a `webview` capability
 * pointing at that page (docs.privy.io/recipes/mobile-key-export), and
 * `unsupported` when it isn't configured — never a fake native export.
 */
const keyExport: KeyExport = KEY_EXPORT_URL
  ? { kind: "webview", url: KEY_EXPORT_URL }
  : { kind: "unsupported", reason: "Key export page is not configured for this build." };

function PrivySessionBridge({ children }: { children: ReactNode }) {
  const { user, isReady, logout } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();
  const emailLogin = useEmailLoginState(useLoginWithEmail);

  const walletAddress = useMemo(() => {
    if (!wallet || !isConnected(wallet)) return null;
    return wallet.wallets?.[0]?.address ?? null;
  }, [wallet]);

  const email = useMemo(() => {
    const account = user?.linked_accounts?.find((a) => a.type === "email");
    return account && "address" in account ? (account.address as string) : null;
  }, [user]);

  /**
   * The port speaks base64 (that's what the API builds and expects back);
   * Privy's Solana provider speaks web3.js transaction objects. The
   * adapter absorbs that conversion so no vendor or chain type escapes
   * into the app.
   */
  const signTransaction = useCallback(
    async (txBase64: string) => {
      if (!wallet || !isConnected(wallet)) {
        throw new Error("Wallet is not ready");
      }
      const provider = await wallet.getProvider();
      const transaction = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
      const { signedTransaction } = await provider.request({
        method: "signTransaction",
        params: { transaction },
      });
      return Buffer.from(signedTransaction.serialize()).toString("base64");
    },
    [wallet],
  );

  const session: WalletSession = useMemo(
    () => ({
      status: !isReady ? "loading" : user ? "ready" : "signed_out",
      user: user ? { providerUserId: user.id, email } : null,
      walletAddress,
      getAccessToken: () => getAccessToken().catch(() => null),
      logout,
      signTransaction,
      keyExport,
    }),
    [isReady, user, email, walletAddress, logout, signTransaction],
  );

  return (
    <SessionContext.Provider value={{ session, emailLogin }}>{children}</SessionContext.Provider>
  );
}

export function PrivySessionProvider({ children }: { children: ReactNode }) {
  if (!APP_ID || !CLIENT_ID) {
    throw new Error(
      "PRIVY_APP_ID / PRIVY_CLIENT_ID missing from app config — set them in app.config.ts extra.",
    );
  }
  return (
    <PrivyProvider appId={APP_ID} clientId={CLIENT_ID}>
      <PrivySessionBridge>{children}</PrivySessionBridge>
    </PrivyProvider>
  );
}

export type { EmailLogin };
