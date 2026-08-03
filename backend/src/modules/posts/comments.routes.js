import { Router } from "express";

import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";

import CommentLikesController from "./controllers/comment-likes.controller.js";

import {
  removeCommentLikeSchema,
  setCommentLikeSchema,
} from "./validations/comment-likes.validation.js";

const router = Router();

router.put(
  "/:commentId/like",
  AuthMiddleware.authenticate,
  validate(setCommentLikeSchema),
  CommentLikesController.setLike,
);

router.delete(
  "/:commentId/like",
  AuthMiddleware.authenticate,
  validate(removeCommentLikeSchema),
  CommentLikesController.removeLike,
);

export default router;