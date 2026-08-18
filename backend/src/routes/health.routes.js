import { Router } from "express";

import Response from "../core/response/index.js";

const router = Router();

router.get("/", async (req, res) => {
    Response.success(res, {

        service: "artictern-api",
    
        status: "healthy"
    
    }, "Health check successful");
});

export default router;