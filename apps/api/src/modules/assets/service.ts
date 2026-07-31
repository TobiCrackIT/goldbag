import type { Asset, Prisma, PrismaClient } from "@prisma/client";
import type { AssetsQuery, PublicAsset } from "@goldbag/shared";

export function toPublicAsset(asset: Asset): PublicAsset {
  return {
    id: asset.id,
    chain: asset.chain as PublicAsset["chain"],
    tokenAddress: asset.tokenAddress,
    symbol: asset.symbol,
    name: asset.name,
    category: asset.category,
    logoUrl: asset.logoUrl,
    decimals: asset.decimals,
    listedAt: asset.listedAt?.toISOString() ?? null,
  };
}

/** Public registry: only `listed` assets, keyset-paginated, searchable. */
export async function listPublicAssets(prisma: PrismaClient, query: AssetsQuery) {
  const where: Prisma.AssetWhereInput = {
    status: "listed",
    ...(query.category ? { category: query.category } : {}),
    ...(query.search
      ? {
          OR: [
            { symbol: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.asset.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const items = (hasMore ? rows.slice(0, query.limit) : rows).map(toPublicAsset);
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
