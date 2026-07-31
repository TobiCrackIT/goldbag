import fp from "fastify-plugin";
import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { apiResponse, err, ok } from "@goldbag/shared";
import { AuthTokenInvalidError, type AuthProvider } from "./provider.js";
import { upsertIdentity, type SessionUser } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  provider: AuthProvider;
  prisma: PrismaClient;
}

/**
 * Decorates `app.authenticate` (preHandler for any protected route) and
 * registers POST /auth/session. Everything here speaks VerifiedIdentity —
 * the vendor lives behind the AuthProvider seam.
 */
export const authPlugin = fp<AuthPluginOptions>(
  async (app, { provider, prisma }) => {
    app.decorateRequest("user", null);

    app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
      if (!token) {
        return reply.code(401).send(err("UNAUTHORIZED", "Missing access token"));
      }
      try {
        const identity = await provider.verifyAccessToken(token);
        req.user = await upsertIdentity(prisma, provider.name, identity);
      } catch (e) {
        if (e instanceof AuthTokenInvalidError) {
          return reply.code(401).send(err("UNAUTHORIZED", "Invalid or expired access token"));
        }
        throw e;
      }
    });

    app.post(
      "/auth/session",
      {
        preHandler: [app.authenticate],
        schema: {
          response: {
            200: apiResponse(
              z.object({
                userId: z.string(),
                walletAddress: z.string().nullable(),
                email: z.string().nullable(),
              }),
            ),
          },
        },
      },
      async (req) => ok(req.user!),
    );
  },
  { name: "auth" },
);
