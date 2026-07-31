// API entrypoint. Env validation happens before anything else boots.
import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { createPrisma } from "./lib/db.js";
import { createRedis } from "./lib/redis.js";
import { createPrivyAuthProvider } from "./modules/auth/providers/privy/index.js";

const env = loadEnv();

if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
  console.error("Fatal: PRIVY_APP_ID / PRIVY_APP_SECRET are required to run the api");
  process.exit(1);
}

const prisma = createPrisma();
const redis = createRedis(env.REDIS_URL);
const app = await buildApp(env, {
  prisma,
  redis,
  authProvider: createPrivyAuthProvider(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET),
  adminToken: env.ADMIN_TOKEN,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.fatal(err, "failed to start api");
  process.exit(1);
}
