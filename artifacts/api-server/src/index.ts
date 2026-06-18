import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
const fallbackPort = 3002;
const hasExplicitPort = rawPort !== undefined;
const initialPort = hasExplicitPort ? Number(rawPort) : fallbackPort;

if (Number.isNaN(initialPort) || initialPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function listen(port: number) {
  const server = createServer(app);

  server.once("error", (err: NodeJS.ErrnoException) => {
    if (!hasExplicitPort && err.code === "EADDRINUSE") {
      logger.warn({ port }, "Port already in use, trying next port");
      listen(port + 1);
      return;
    }

    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });

  server.listen(port, () => {
    logger.info({ port, fallback: !hasExplicitPort }, "Server listening");
  });
}

listen(initialPort);
