import logger from "./logger.js";

export default function requestLogger(req, res, next) {

    req.context = {
        requestId: req.id,
        startTime: process.hrtime.bigint(),

        userId: null,
        sessionId: null,
        pageId: null,
        tenantId: null
    };

    req.logger = logger.child({
        requestId: req.context.requestId
    });

    res.on("finish", () => {

        const durationMs =
            Number(process.hrtime.bigint() - req.context.startTime) / 1000000;

        req.logger.info({

            method: req.method,

            url: req.originalUrl,

            statusCode: res.statusCode,

            duration: `${durationMs.toFixed(2)} ms`,

            ip: req.ip,

            userAgent: req.get("user-agent"),

            userId: req.context.userId,

            sessionId: req.context.sessionId,

            pageId: req.context.pageId

        }, "HTTP Request Completed");

    });

    next();
}