import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  res.json({
    success: true,
    service: "artictern-api",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

export default router;