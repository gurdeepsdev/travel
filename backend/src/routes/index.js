import { Router } from "express";

import healthRoutes from "./health.routes.js";
import testRoutes from "./test.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
const router = Router();

router.use("/health", healthRoutes);

router.use("/test", testRoutes);
router.use("/auth", authRoutes);

export default router;
