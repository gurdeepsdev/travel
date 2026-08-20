import {
  Router,
} from "express";

import optionalAuthMiddleware
  from "../../middleware/optional-auth.middleware.js";

import validate
  from "../../middleware/validate.middleware.js";

import ExploreController
  from "./controllers/explore.controller.js";
import {
  getExploreCitiesSchema,
  getExploreCityPlacesSchema,
  getExploreFeedSchema,
  getExplorePlacesSchema,
} from "./validations/explore.validation.js";

const router =
  Router();

router.get(
  "/cities",
  validate(
    getExploreCitiesSchema,
  ),
  ExploreController.getCities,
);


router.get(
  "/cities/:cityId/places",
  validate(
    getExploreCityPlacesSchema,
  ),
  ExploreController.getCityPlaces,
);

router.get(
  "/places",
  validate(
    getExplorePlacesSchema,
  ),
  ExploreController.getPlaces,
);

router.get(
  "/feed",
  optionalAuthMiddleware,
  validate(
    getExploreFeedSchema,
  ),
  ExploreController.getFeed,
);

export default router;
