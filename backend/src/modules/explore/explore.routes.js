import {
  Router,
} from "express";

import optionalAuthMiddleware
  from "../../middleware/optional-auth.middleware.js";

import validate
  from "../../middleware/validate.middleware.js";

import ExploreController
  from "./controllers/explore.controller.js";
import CitySavesController
  from "./controllers/city-saves.controller.js";
import AuthMiddleware
  from "../../middleware/auth.middleware.js";
import {
  citySaveSchema,
} from "./validations/city-saves.validation.js";
import {
  getExploreCountriesSchema,
  getExploreCitiesSchema,
  getExploreCityPlacesSchema,
  getExploreFeedSchema,
  getExplorePlacesSchema,
} from "./validations/explore.validation.js";

const router =
  Router();

router.get(
  "/countries",
  validate(
    getExploreCountriesSchema,
  ),
  ExploreController.getCountries,
);

router.get(
  "/cities",
  optionalAuthMiddleware,
  validate(
    getExploreCitiesSchema,
  ),
  ExploreController.getCities,
);

router.put(
  "/cities/:cityId/saved",
  AuthMiddleware.authenticate,
  validate(citySaveSchema),
  CitySavesController.saveCity,
);

router.delete(
  "/cities/:cityId/saved",
  AuthMiddleware.authenticate,
  validate(citySaveSchema),
  CitySavesController.removeSavedCity,
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
