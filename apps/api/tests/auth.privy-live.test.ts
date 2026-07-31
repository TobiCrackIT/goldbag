import { describe, expect, it } from "vitest";

// Live checks against the real Privy app — gated on credentials so CI
// without secrets stays green. Proves the production adapter rejects
// forged tokens using Privy's real verification key.
const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

describe.skipIf(!appId || !appSecret)("privy adapter (live)", () => {
  it("rejects a forged token against the real verification key", async () => {
    const { createPrivyAuthProvider } = await import(
      "../src/modules/auth/providers/privy/index.js"
    );
    const provider = createPrivyAuthProvider(appId!, appSecret!);
    const forged =
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ sub: "did:privy:forged", exp: Date.now() / 1000 + 3600 })).toString("base64url") +
      ".Zm9yZ2VkLXNpZ25hdHVyZQ";
    await expect(provider.verifyAccessToken(forged)).rejects.toThrow(
      "invalid or expired access token",
    );
  });

  it("app credentials are valid (REST reachability)", async () => {
    const res = await fetch(`https://auth.privy.io/api/v1/apps/${appId}`, {
      headers: {
        authorization: "Basic " + Buffer.from(`${appId}:${appSecret}`).toString("base64"),
        "privy-app-id": appId!,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(appId);
  });
});
