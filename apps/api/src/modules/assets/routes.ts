import fp from "fastify-plugin";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { PrismaClient } from "@prisma/client";
import {
  AssetCategory,
  AssetStatus,
  AssetsPage,
  AssetsQuery,
  ErrorResponseSchema,
  PublicAsset,
  apiResponse,
  err,
  ok,
} from "@goldbag/shared";
import { listPublicAssets, toPublicAsset } from "./service.js";

export interface AssetsPluginOptions {
  prisma: PrismaClient;
  /** Admin routes refuse to register without a token (no accidental open admin). */
  adminToken?: string;
}

const AdminAssetInput = z.object({
  chain: z.string().default("solana"),
  tokenAddress: z.string().min(32),
  symbol: z.string().min(1).max(16),
  name: z.string().min(1).max(120),
  category: AssetCategory,
  decimals: z.number().int().min(0).max(18),
  logoUrl: z.url().nullish(),
  status: AssetStatus.default("paused"),
});

const AdminAssetPatch = AdminAssetInput.partial().omit({ chain: true, tokenAddress: true });

// Full row for admin eyes (includes status, unlike the public shape).
const AdminAsset = PublicAsset.extend({ status: AssetStatus });

export const assetsPlugin = fp<AssetsPluginOptions>(
  async (rawApp, { prisma, adminToken }) => {
    // fastify-plugin erases the type provider generic; re-assert it.
    const app = rawApp.withTypeProvider<ZodTypeProvider>();
    app.get(
      "/assets",
      { schema: { querystring: AssetsQuery, response: { 200: apiResponse(AssetsPage) } } },
      async (req) => ok(await listPublicAssets(prisma, req.query)),
    );

    if (!adminToken) {
      app.log.warn("ADMIN_TOKEN not set — admin asset routes disabled");
      return;
    }

    const guard = (candidate: string | undefined) => {
      if (!candidate) return false;
      const a = Buffer.from(candidate);
      const b = Buffer.from(adminToken);
      return a.length === b.length && timingSafeEqual(a, b);
    };

    await app.register(async (rawAdmin) => {
      const admin = rawAdmin.withTypeProvider<ZodTypeProvider>();
      admin.addHook("onRequest", async (req, reply) => {
        if (!guard(req.headers["x-admin-token"] as string | undefined)) {
          return reply.code(401).send(err("UNAUTHORIZED", "Invalid admin token"));
        }
      });

      admin.get(
        "/admin/assets",
        { schema: { response: { 200: apiResponse(z.array(AdminAsset)) } } },
        async () => {
          const rows = await prisma.asset.findMany({ orderBy: { createdAt: "asc" } });
          return ok(rows.map((r) => ({ ...toPublicAsset(r), status: r.status })));
        },
      );

      admin.post(
        "/admin/assets",
        {
          schema: {
            body: AdminAssetInput,
            response: { 200: apiResponse(AdminAsset), 400: ErrorResponseSchema },
          },
        },
        async (req, reply) => {
          const input = req.body;
          const existing = await prisma.asset.findUnique({
            where: { chain_tokenAddress: { chain: input.chain, tokenAddress: input.tokenAddress } },
          });
          if (existing) {
            return reply.code(400).send(err("VALIDATION_ERROR", "Asset already registered"));
          }
          const row = await prisma.asset.create({
            data: {
              ...input,
              logoUrl: input.logoUrl ?? null,
              listedAt: input.status === "listed" ? new Date() : null,
            },
          });
          return ok({ ...toPublicAsset(row), status: row.status });
        },
      );

      admin.patch(
        "/admin/assets/:id",
        {
          schema: {
            params: z.object({ id: z.string() }),
            body: AdminAssetPatch,
            response: { 200: apiResponse(AdminAsset), 404: ErrorResponseSchema },
          },
        },
        async (req, reply) => {
          const current = await prisma.asset.findUnique({ where: { id: req.params.id } });
          if (!current) {
            return reply.code(404).send(err("NOT_FOUND", "No such asset"));
          }
          const row = await prisma.asset.update({
            where: { id: current.id },
            data: {
              ...req.body,
              // First transition to listed stamps listedAt (powers "New" badge).
              ...(req.body.status === "listed" && !current.listedAt
                ? { listedAt: new Date() }
                : {}),
            },
          });
          return ok({ ...toPublicAsset(row), status: row.status });
        },
      );
    });
  },
  { name: "assets" },
);
