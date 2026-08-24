import { Router } from "express";

import healthRoutes from "./health.routes.js";
import docsRoutes from "./docs.routes.js";
import testRoutes from "./test.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import postsRoutes from "../modules/posts/posts.routes.js";
import commentsRoutes from "../modules/posts/comments.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import exploreRoutes
  from "../modules/explore/explore.routes.js";
import itineraryRoutes
  from "../modules/itinerary/itinerary.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/docs", docsRoutes);

router.use("/test", testRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/posts", postsRoutes);
router.use("/comments", commentsRoutes);
router.use(
  "/media",
  mediaRoutes,
);
router.use(
  "/explore",
  exploreRoutes,
);
router.use(
  "/itineraries",
  itineraryRoutes,
);


export default router;
