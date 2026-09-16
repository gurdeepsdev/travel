import {
  Router,
} from "express";

import optionalAuthMiddleware from "../../middleware/optional-auth.middleware.js";

import validate from "../../middleware/validate.middleware.js";

import MediaController from "./media.controller.js";

import {
  getAssetContentSchema,
  getAssetStreamResourceSchema,
} from "./media.validation.js";

const router =
  Router();

router.get(
  "/assets/:assetId/stream/master.m3u8",
  optionalAuthMiddleware,
  validate(
    getAssetContentSchema,
  ),
  MediaController
    .getAssetStreamManifest,
);

router.get(
  "/assets/:assetId/stream/:rendition/:fileName",
  optionalAuthMiddleware,
  validate(
    getAssetStreamResourceSchema,
  ),
  MediaController
    .getAssetStreamResource,
);

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
