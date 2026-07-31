import { useEffect } from "react";
import { setAccessTokenProvider } from "../../../lib/api/client";
import { useSession } from "./context";

/**
 * Feeds the session's access token to the API client. Lives here rather
 * than inside the client so `src/lib/api` stays free of any auth vendor —
 * the client only ever knows "something can give me a token".
 */
export function ApiTokenBridge() {
  const session = useSession();
  const getAccessToken = session.getAccessToken;

  useEffect(() => {
    setAccessTokenProvider(getAccessToken);
    return () => setAccessTokenProvider(null);
  }, [getAccessToken]);

  return null;
}
