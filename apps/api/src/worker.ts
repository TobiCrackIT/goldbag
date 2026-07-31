// Worker entrypoint. BullMQ processors attach here from task 1.5 onward;
// until then it is a heartbeat loop proving the deploy shape works.
import { pino } from "pino";
import { loadEnv } from "./config/env.js";
import { loggerOptions } from "./lib/logger.js";

const env = loadEnv();
const log = pino(loggerOptions(env));

const heartbeat = setInterval(() => {
  log.info("worker heartbeat — no processors registered yet");
}, 60_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info({ signal }, "worker shutting down");
    clearInterval(heartbeat);
    process.exit(0);
  });
}

log.info("worker started");
