import { Router } from "express";

import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";

import CommentLikesController from "./controllers/comment-likes.controller.js";
import PostCommentsController from "./controllers/post-comments.controller.js";

import {
  getCommentLikesSchema,
  removeCommentLikeSchema,
  setCommentLikeSchema,
} from "./validations/comment-likes.validation.js";

import {
  deleteCommentSchema,
} from "./validations/post-comments.validation.js";

const router = Router();

// Delete a comment as its author or post owner.
router.delete(
  "/:commentId",
  AuthMiddleware.authenticate,
  validate(deleteCommentSchema),
  PostCommentsController.deleteComment,
);

// List comment likers as the post owner.
router.get(
  "/:commentId/likes",
  AuthMiddleware.authenticate,
  validate(getCommentLikesSchema),
  CommentLikesController.getCommentLikes,
);

// Like a comment as an authenticated user.
router.put(
  "/:commentId/like",
  AuthMiddleware.authenticate,
  validate(setCommentLikeSchema),
  CommentLikesController.setLike,
);
// Remove a comment like as an authenticated user.
router.delete(
  "/:commentId/like",
  AuthMiddleware.authenticate,
  validate(removeCommentLikeSchema),
  CommentLikesController.removeLike,
);

export default router;