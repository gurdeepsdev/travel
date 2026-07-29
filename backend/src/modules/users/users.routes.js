import { Router } from "express";

import UsersController from "./users.controller.js";
import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import { getMyPostsSchema } from "./validations/user-posts.validation.js";

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

export default router;