import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";

import requestIdMiddleware from "./middleware/request-id.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

import requestLogger from "./core/logger/request-logger.js";

const app = express();

app.use(helmet());

app.use(cors());

app.use(compression());

app.use(cookieParser());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(requestIdMiddleware);

app.use(requestLogger);

app.use("/api/v1", routes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

app.use(errorMiddleware);

export default app;