import { Router } from "express";

import healthRoutes from "./health.routes.js";
import testRoutes from "./test.routes.js";

const router = Router();

router.use("/health", healthRoutes);

router.use("/test", testRoutes);

export default router;