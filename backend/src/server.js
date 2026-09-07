import app from "./app.js";
import { createServer } from "node:http";

import env from "./config/env.js";

import logger from "./core/logger/logger.js";

import { connectInfrastructure } from "./config/database.js";
import {
  initializeRealtimeServer,
} from "./realtime/realtime-server.js";
import {
  startEngagementOutboxWorker,
  stopEngagementOutboxWorker,
} from "./realtime/engagement-outbox.worker.js";
const PORT = env.APP_PORT;

async function bootstrap() {
  await connectInfrastructure();

  const httpServer = createServer(app);
  initializeRealtimeServer(httpServer);
  startEngagementOutboxWorker();

  httpServer.listen(PORT, () => {
    logger.info(
      `🚀 Artictern API running on port ${PORT}`
    );
  });

  const shutdown = () => {
    stopEngagementOutboxWorker();
    httpServer.close();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

bootstrap();
