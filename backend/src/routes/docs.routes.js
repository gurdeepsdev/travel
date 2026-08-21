import path from "node:path";

import { Router } from "express";

const router = Router();

const openApiBundlePath = path.resolve(
  process.cwd(),
  "today-apis.bundle.yaml",
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
