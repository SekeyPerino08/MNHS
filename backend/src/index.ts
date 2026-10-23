// Starts the HTTP server and disconnects Prisma during shutdown.
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received; shutting down`);

  server.close((serverError) => {
    void (async () => {
      try {
        await prisma.$disconnect();
        if (serverError) {
          console.error("Error while closing the HTTP server:", serverError);
          process.exitCode = 1;
        }
      } catch (disconnectError) {
        console.error("Error while disconnecting Prisma:", disconnectError);
        process.exitCode = 1;
      }
    })();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
