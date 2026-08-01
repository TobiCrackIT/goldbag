import { useCallback, useState } from "react";
import type { useLoginWithEmail } from "@privy-io/expo";
import type { EmailLogin, EmailLoginState } from "../../session/types";

/**
 * Adapts Privy's email OTP hook into the port's EmailLogin shape, so the
 * login screen never sees a vendor type. Errors are normalised to
 * sentences a user can act on.
 */
export function useEmailLoginState(hook: typeof useLoginWithEmail): EmailLogin {
  const { sendCode: privySendCode, loginWithCode } = hook();
  const [state, setState] = useState<EmailLoginState>({ step: "idle" });

  const sendCode = useCallback(
    async (email: string) => {
      const trimmed = email.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
        setState({ step: "error", message: "That doesn't look like an email address." });
        return;
      }
      setState({ step: "sending" });
      try {
        await privySendCode({ email: trimmed });
        setState({ step: "awaiting_code", email: trimmed });
      } catch {
        setState({ step: "error", message: "We couldn't send that code. Please try again." });
      }
    },
    [privySendCode],
  );

  const submitCode = useCallback(
    async (code: string) => {
      const email = state.step === "awaiting_code" ? state.email : "";
      setState({ step: "verifying", email });
      try {
        await loginWithCode({ code: code.trim(), email });
        // Success flips usePrivy().user; the router reacts to that.
      } catch {
        setState({ step: "error", message: "That code didn't work. Check it and try again." });
      }
    },
    [loginWithCode, state],
  );

  const reset = useCallback(() => setState({ step: "idle" }), []);

  return { state, sendCode, submitCode, reset };
}
