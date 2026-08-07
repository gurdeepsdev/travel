import { Router } from "express";

import UsersController from "./users.controller.js";
import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import profilePhotoUploadMiddleware
  from "./middleware/profile-photo-upload.middleware.js";
import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";
import SavedContentController from "./controllers/saved-content.controller.js";
import MemoriesController from "./controllers/memories.controller.js";
import ConnectionsController
  from "./controllers/connections.controller.js";


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

import {
  cancelConnectionRequestSchema,
  getIncomingConnectionRequestsSchema,
  getMyConnectionsSchema,
  getOutgoingConnectionRequestsSchema,
  removeConnectionSchema,
  respondToConnectionRequestSchema,
  sendConnectionRequestSchema,
} from "./validations/connections.validation.js";

const router = Router();

router.get(
    "/me",
    AuthMiddleware.authenticate,
    UsersController.me
);

//profile update
router.patch(
  "/me/profile",
  AuthMiddleware.authenticate,
  profilePhotoUploadMiddleware,
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

// List pending requests received by the current user.
router.get(
  "/me/connection-requests/incoming",
  AuthMiddleware.authenticate,
  validate(
    getIncomingConnectionRequestsSchema,
  ),
  ConnectionsController
    .getIncomingConnectionRequests,
);


// List the current user's accepted connections.
router.get(
  "/me/connections",
  AuthMiddleware.authenticate,
  validate(
    getMyConnectionsSchema,
  ),
  ConnectionsController
    .getMyConnections,
);

// Remove an accepted connection.
router.delete(
  "/me/connections/:userId",
  AuthMiddleware.authenticate,
  validate(
    removeConnectionSchema,
  ),
  ConnectionsController
    .removeConnection,
);


// List pending requests sent by the current user.
router.get(
  "/me/connection-requests/outgoing",
  AuthMiddleware.authenticate,
  validate(
    getOutgoingConnectionRequestsSchema,
  ),
  ConnectionsController
    .getOutgoingConnectionRequests,
);

// Accept or reject a received connection request.
router.patch(
  "/me/connection-requests/:requestId",
  AuthMiddleware.authenticate,
  validate(
    respondToConnectionRequestSchema,
  ),
  ConnectionsController
    .respondToConnectionRequest,
);

// Cancel a pending request sent by the current user.
router.delete(
  "/me/connection-requests/:requestId",
  AuthMiddleware.authenticate,
  validate(
    cancelConnectionRequestSchema,
  ),
  ConnectionsController
    .cancelConnectionRequest,
);

// Send a connection request to another user.
router.post(
  "/:userId/connection-requests",
  AuthMiddleware.authenticate,
  validate(
    sendConnectionRequestSchema,
  ),
  ConnectionsController
    .sendConnectionRequest,
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