import type { Env } from "../config/env.js";

/**
 * Shared pino options for the Fastify logger and the worker. The redaction
 * list is the enforcement point for "secrets never reach logs" — extend it
 * whenever a new secret-bearing field appears.
 */
export function loggerOptions(env: Env) {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.secret",
        "*.privateKey",
        "*.accessToken",
        "*.refreshToken",
      ],
      censor: "[redacted]",
    },
  };
}
