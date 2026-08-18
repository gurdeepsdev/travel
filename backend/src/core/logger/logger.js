import pino from "pino";
import env from "../../config/env.js";

const logger = pino({
    level: env.LOG_LEVEL,

    timestamp: pino.stdTimeFunctions.isoTime,

    base: {
        service: env.APP_NAME,
        environment: env.NODE_ENV
    }
});

export default logger;