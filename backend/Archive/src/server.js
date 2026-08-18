import app from "./app.js";

import env from "./config/env.js";

import logger from "./core/logger/logger.js";

import { connectInfrastructure } from "./config/database.js";
const PORT = env.APP_PORT;

async function bootstrap() {
    await connectInfrastructure();
  app.listen(PORT, () => {
    logger.info(
      `🚀 Artictern API running on port ${PORT}`
    );
  });
}

bootstrap();