import { Router } from "express";

import UsersController from "./users.controller.js";
import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";
import SavedContentController from "./controllers/saved-content.controller.js";
import MemoriesController from "./controllers/memories.controller.js";

import {
  updateMyProfileSchema,
} from "./validations/profile.validation.js";

import {
    getMyPostsSchema,
    getUserPostsSchema,
  } from "./validations/user-posts.validation.js";
import {
  getMySavedPostsSchema,
  getUserSavedPlacesSchema,
} from "./validations/saved-content.validation.js";
import {
  getMyMemoriesSchema,
  saveMemorySchema,
} from "./validations/memories.validation.js";

const router = Router();

router.get(
    "/me",
    AuthMiddleware.authenticate,
    UsersController.me
);

router.patch(
  "/me/profile",
  AuthMiddleware.authenticate,
  validate(updateMyProfileSchema),
  UsersController.updateMyProfile,
);

// Save an owned image, video, or boomerang.
router.post(
  "/me/memories",
  AuthMiddleware.authenticate,
  validate(saveMemorySchema),
  MemoriesController.saveMemory,
);

// Get the authenticated user's private memories.
router.get(
  "/me/memories",
  AuthMiddleware.authenticate,
  validate(getMyMemoriesSchema),
  MemoriesController.getMyMemories,
);

router.get(
    "/me/posts",
    AuthMiddleware.authenticate,
    validate(getMyPostsSchema),
    UsersController.getMyPosts
);
router.get(
  "/me/saved-posts",
  AuthMiddleware.authenticate,
  validate(getMySavedPostsSchema),
  SavedContentController
    .getMySavedPosts,
);

router.get(
    "/:username/posts",
    optionalAuthMiddleware,
    validate(getUserPostsSchema),
    UsersController.getUserPosts,
  );

router.get(
  "/:username/saved-places",
  optionalAuthMiddleware,
  validate(getUserSavedPlacesSchema),
  SavedContentController
    .getUserSavedPlaces,
);

export default router;