import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { apiResponse, ok } from "@goldbag/shared";
import type { Env } from "./config/env.js";
import { loggerOptions } from "./lib/logger.js";

export function buildApp(env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : loggerOptions(env),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

export type App = ReturnType<typeof buildApp>;
