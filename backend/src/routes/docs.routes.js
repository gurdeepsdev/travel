import path from "node:path";

import { Router } from "express";
import swaggerUi from "swagger-ui-express";

const router = Router();

const openApiBundlePath = path.resolve(
  process.cwd(),
  "today-apis.bundle.yaml",
);

const swaggerUiOptions = {
  customSiteTitle:
    "Artictern API Documentation",
  swaggerOptions: {
    url:
      "/api/v1/docs/openapi.yaml",
  },
};

router.use(
  "/",
  (req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:; " +
        "style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline'",
    );
    next();
  },
  swaggerUi.serve,
);

router.get(
  "/",
  swaggerUi.setup(
    null,
    swaggerUiOptions,
  ),
);

router.get(
  "/openapi.yaml",
  (req, res, next) => {
    res.type("application/yaml");
    res.sendFile(
      openApiBundlePath,
      (error) => {
        if (error) {
          next(error);
        }
      },
    );
  },
);

export default router;
