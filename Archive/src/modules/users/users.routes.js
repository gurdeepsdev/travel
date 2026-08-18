import { Router } from "express";

import UsersController from "./users.controller.js";
import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";

import {
    getMyPostsSchema,
    getUserPostsSchema,
  } from "./validations/user-posts.validation.js";
const router = Router();

router.get(
    "/me",
    AuthMiddleware.authenticate,
    UsersController.me
);

router.get(
    "/me/posts",
    AuthMiddleware.authenticate,
    validate(getMyPostsSchema),
    UsersController.getMyPosts
);

router.get(
    "/:username/posts",
    optionalAuthMiddleware,
    validate(getUserPostsSchema),
    UsersController.getUserPosts,
  );

export default router;