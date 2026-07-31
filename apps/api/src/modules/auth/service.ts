import type { PrismaClient } from "@prisma/client";
import type { VerifiedIdentity } from "./provider.js";

export interface SessionUser {
  userId: string;
  walletAddress: string | null;
  email: string | null;
}

/**
 * Map a verified identity to our users/wallets rows, creating them on
 * first sight (architecture §4.5 "Auth"). Wallet rows are append-only:
 * an address seen once stays attached to the user.
 */
export async function upsertIdentity(
  prisma: PrismaClient,
  providerName: string,
  identity: VerifiedIdentity,
): Promise<SessionUser> {
  const user = await prisma.user.upsert({
    where: {
      authProvider_providerUserId: {
        authProvider: providerName,
        providerUserId: identity.providerUserId,
      },
    },
    create: {
      authProvider: providerName,
      providerUserId: identity.providerUserId,
      email: identity.email ?? null,
    },
    update: identity.email ? { email: identity.email } : {},
    include: { wallets: true },
  });

  const known = new Set(user.wallets.map((w) => `${w.chain}:${w.address}`));
  for (const wallet of identity.wallets) {
    if (!known.has(`${wallet.chain}:${wallet.address}`)) {
      await prisma.wallet.upsert({
        where: { chain_address: { chain: wallet.chain, address: wallet.address } },
        create: {
          userId: user.id,
          chain: wallet.chain,
          address: wallet.address,
          isPrimary: user.wallets.length === 0,
        },
        update: {},
      });
    }
  }

  const primary =
    identity.wallets[0]?.address ?? user.wallets.find((w) => w.isPrimary)?.address ?? null;
  return { userId: user.id, walletAddress: primary, email: user.email };
}
