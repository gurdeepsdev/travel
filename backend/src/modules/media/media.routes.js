import {
  Router,
} from "express";

import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";

import validate from "../../middleware/validate.middleware.js";

import MediaController from "./media.controller.js";

import {
  getAssetContentSchema,
} from "./media.validation.js";

const router =
  Router();

router.get(
  "/assets/:assetId/content",
  optionalAuthMiddleware,
  validate(
    getAssetContentSchema,
  ),
  MediaController
    .getAssetContent,
);

router.get(
  "/assets/:assetId/thumbnail",
  optionalAuthMiddleware,
  validate(
    getAssetContentSchema,
  ),
  MediaController
    .getAssetThumbnail,
);

export default router;
