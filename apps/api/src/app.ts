import Fastify, { type FastifyError } from "fastify";
import rateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";
import { apiResponse, err, ok } from "@goldbag/shared";
import type { Env } from "./config/env.js";
import { loggerOptions } from "./lib/logger.js";
import { authPlugin } from "./modules/auth/plugin.js";
import type { AuthProvider } from "./modules/auth/provider.js";
import { assetsPlugin } from "./modules/assets/routes.js";

export interface AppDeps {
  prisma: PrismaClient;
  authProvider: AuthProvider;
  /** Redis-backed limits in real deployments; in-memory store when absent (tests). */
  redis?: Redis;
  /** Override for tests; production default is generous per-identity. */
  rateLimit?: { max: number; timeWindowMs: number };
  /** Allowlist token for /admin routes; admin surface disabled when absent. */
  adminToken?: string;
}

export async function buildApp(env: Env, deps: AppDeps) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : loggerOptions(env),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(rateLimit, {
    global: true,
    max: deps.rateLimit?.max ?? 120,
    timeWindow: deps.rateLimit?.timeWindowMs ?? 60_000,
    ...(deps.redis ? { redis: deps.redis } : {}),
    // Per-user once authenticated, per-IP before that (PRD 7.7).
    keyGenerator: (req) => req.user?.userId ?? req.ip,
  });

  // Single choke point for the error envelope: raw provider/framework
  // errors never leave the API (architecture §6).
  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error.statusCode === 429) {
      return reply.code(429).send(err("RATE_LIMITED", "Too many requests — slow down"));
    }
    if (error.validation) {
      return reply.code(400).send(err("VALIDATION_ERROR", "Invalid request"));
    }
    req.log.error(error);
    return reply.code(500).send(err("INTERNAL", "Something went wrong"));
  });

  await app.register(authPlugin, { provider: deps.authProvider, prisma: deps.prisma });
  await app.register(assetsPlugin, { prisma: deps.prisma, adminToken: deps.adminToken });

  app.get(
    "/health",
    {
      schema: {
        response: { 200: apiResponse(z.object({ status: z.literal("ok") })) },
      },
    },
    async () => ok({ status: "ok" as const }),
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
