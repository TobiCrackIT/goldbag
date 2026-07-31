// Seed the asset registry with the launch set decided in
// docs/spikes/gold-silver-mints/REPORT.md. Idempotent (upsert on
// (chain, tokenAddress)) so it can run against any environment.
import { PrismaClient, AssetCategory, AssetStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_ASSETS = [
  {
    chain: "solana",
    tokenAddress: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    symbol: "AAPLx",
    name: "Apple xStock",
    category: AssetCategory.stock,
    decimals: 8,
    status: AssetStatus.listed,
  },
  {
    chain: "solana",
    tokenAddress: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
    symbol: "GLDx",
    name: "Gold xStock (SPDR Gold Shares)",
    category: AssetCategory.gold_silver,
    decimals: 8,
    status: AssetStatus.listed,
  },
  {
    chain: "solana",
    tokenAddress: "AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P",
    symbol: "XAUt0",
    name: "Tether Gold",
    category: AssetCategory.gold_silver,
    decimals: 6,
    status: AssetStatus.listed,
  },
] as const;

for (const asset of SEED_ASSETS) {
  await prisma.asset.upsert({
    where: { chain_tokenAddress: { chain: asset.chain, tokenAddress: asset.tokenAddress } },
    create: { ...asset, listedAt: new Date() },
    update: {},
  });
  console.log(`seeded ${asset.symbol}`);
}

await prisma.$disconnect();
