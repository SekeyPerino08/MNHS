// Starts the HTTP server and disconnects Prisma during shutdown.
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Server listening");
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Shutting down");

  server.close((serverError) => {
    void (async () => {
      try {
        await prisma.$disconnect();
        if (serverError) {
          logger.error({ err: serverError }, "Error while closing the HTTP server");
          process.exitCode = 1;
        }
      } catch (disconnectError) {
        logger.error({ err: disconnectError }, "Error while disconnecting Prisma");
        process.exitCode = 1;
      }
    })();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
