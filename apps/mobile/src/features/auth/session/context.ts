import { createContext, useContext } from "react";
import type { EmailLogin, WalletSession } from "./types";

export interface SessionContextValue {
  session: WalletSession;
  emailLogin: EmailLogin;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

/** The app's single source for auth + wallet state (architecture §5.3). */
export function useSession(): WalletSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside the session provider");
  return ctx.session;
}

export function useEmailLogin(): EmailLogin {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useEmailLogin must be used inside the session provider");
  return ctx.emailLogin;
}
