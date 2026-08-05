import { Router } from "express";

import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";

import PostReactionsController from "./controllers/post-reactions.controller.js";
import PostBeenThereController from "./controllers/post-been-there.controller.js";
import PostCommentsController from "./controllers/post-comments.controller.js";
import PostSavesController from "./controllers/post-saves.controller.js";
import PostCreateController from "./controllers/post-create.controller.js";

import postMediaUploadMiddleware from "./middleware/post-media-upload.middleware.js";
import {
  getPostBeenThereSchema,
  removePostBeenThereSchema,
  setPostBeenThereSchema,
} from "./validations/post-been-there.validation.js";

import {
  getPostReactionsSchema,
  removePostReactionSchema,
  setPostReactionSchema,
} from "./validations/post-reactions.validation.js";

import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";

import {
  createPostCommentSchema,
  getPostCommentsSchema,
} from "./validations/post-comments.validation.js";

import {
  removeSavedPostSchema,
  savePostSchema,
} from "./validations/post-saves.validation.js";


import {
  createPostSchema,
} from "./validations/post-create.validation.js";


const router = Router();

// Create a post with uploaded or existing media.
router.post(
  "/",
  AuthMiddleware.authenticate,
  postMediaUploadMiddleware,
  validate(createPostSchema),
  PostCreateController.createPost,
);

//add reaction
router.put(
  "/:postId/reaction",
  AuthMiddleware.authenticate,
  validate(setPostReactionSchema),
  PostReactionsController.setReaction,
);

//remove reaction
router.delete(
  "/:postId/reaction",
  AuthMiddleware.authenticate,
  validate(removePostReactionSchema),
  PostReactionsController.removeReaction,
);

//add been there
router.put(
    "/:postId/been-there",
    AuthMiddleware.authenticate,
    validate(setPostBeenThereSchema),
    PostBeenThereController.setBeenThere,
  );

  //remove been there
  router.delete(
    "/:postId/been-there",
    AuthMiddleware.authenticate,
    validate(removePostBeenThereSchema),
    PostBeenThereController.removeBeenThere,
  );

  //add comments
  router.post(
    "/:postId/comments",
    AuthMiddleware.authenticate,
    validate(createPostCommentSchema),
    PostCommentsController.createComment,
  );

//get reactions 
  router.get(
  "/:postId/reactions",
  optionalAuthMiddleware,
  validate(getPostReactionsSchema),
  PostReactionsController
    .getPostReactions,
);

//get been there
router.get(
  "/:postId/been-there",
  optionalAuthMiddleware,
  validate(getPostBeenThereSchema),
  PostBeenThereController
    .getPostBeenThere,
);


// Get top-level comments for a post.
router.get(
  "/:postId/comments",
  optionalAuthMiddleware,
  validate(getPostCommentsSchema),
  PostCommentsController.getPostComments,
);


// Save or reactivate a post.
router.put(
  "/:postId/saved",
  AuthMiddleware.authenticate,
  validate(savePostSchema),
  PostSavesController.savePost,
);

// Remove a saved post.
router.delete(
  "/:postId/saved",
  AuthMiddleware.authenticate,
  validate(removeSavedPostSchema),
  PostSavesController.removeSavedPost,
);


export default router;