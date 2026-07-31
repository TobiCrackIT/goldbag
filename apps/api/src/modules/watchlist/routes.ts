import fp from "fastify-plugin";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { PrismaClient } from "@prisma/client";
import { ErrorResponseSchema, PublicAsset, apiResponse, err, ok } from "@goldbag/shared";
import { toPublicAsset } from "../assets/service.js";

export interface WatchlistPluginOptions {
  prisma: PrismaClient;
}

const Params = z.object({ assetId: z.string() });

export const watchlistPlugin = fp<WatchlistPluginOptions>(
  async (rawApp, { prisma }) => {
    const app = rawApp.withTypeProvider<ZodTypeProvider>();

    app.get(
      "/watchlist",
      {
        preHandler: [app.authenticate],
        schema: { response: { 200: apiResponse(z.array(PublicAsset)) } },
      },
      async (req) => {
        const items = await prisma.watchlistItem.findMany({
          where: { userId: req.user!.userId },
          include: { asset: true },
          orderBy: { createdAt: "asc" },
        });
        return ok(
          items.filter((i) => i.asset.status === "listed").map((i) => toPublicAsset(i.asset)),
        );
      },
    );

    app.post(
      "/watchlist/:assetId",
      {
        preHandler: [app.authenticate],
        schema: {
          params: Params,
          response: { 200: apiResponse(z.object({ added: z.boolean() })), 404: ErrorResponseSchema },
        },
      },
      async (req, reply) => {
        const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } });
        if (!asset || asset.status !== "listed") {
          return reply.code(404).send(err("NOT_FOUND", "No such asset"));
        }
        // PK (userId, assetId): double-add is a no-op, not an error.
        await prisma.watchlistItem.upsert({
          where: { userId_assetId: { userId: req.user!.userId, assetId: asset.id } },
          create: { userId: req.user!.userId, assetId: asset.id },
          update: {},
        });
        return ok({ added: true });
      },
    );

    app.delete(
      "/watchlist/:assetId",
      {
        preHandler: [app.authenticate],
        schema: { params: Params, response: { 200: apiResponse(z.object({ removed: z.boolean() })) } },
      },
      async (req) => {
        // deleteMany: removing an absent item is a no-op, not an error.
        const res = await prisma.watchlistItem.deleteMany({
          where: { userId: req.user!.userId, assetId: req.params.assetId },
        });
        return ok({ removed: res.count > 0 });
      },
    );
  },
  { name: "watchlist", dependencies: ["auth"] },
);
