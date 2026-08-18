// import DatabaseManager from "../database/database-manager.js";
// import logger from "../core/logger/logger.js";

// export async function connectDatabase() {
//   try {
//     await DatabaseManager.healthCheck();

//     logger.info("✅ PostgreSQL Connected");
//   } catch (error) {
//     logger.error(error);

//     process.exit(1);
//   }
// }

import DatabaseManager from "../database/database-manager.js";
import redis from "./redis.js";

import logger from "../core/logger/logger.js";

export async function connectInfrastructure() {
  try {
    await DatabaseManager.healthCheck();
    logger.info("✅ PostgreSQL Connected");

    await redis.ping();
    logger.info("✅ Redis Connected");
  } catch (error) {
    logger.error(error);

    process.exit(1);
  }
}