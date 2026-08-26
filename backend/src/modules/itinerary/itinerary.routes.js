import {
  Router,
} from "express";

import AuthMiddleware
  from "../../middleware/auth.middleware.js";
import validate
  from "../../middleware/validate.middleware.js";

import ItineraryController
  from "./itinerary.controller.js";
import {
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
} from "./itinerary.validation.js";

const router = Router();

router.get(
  "/",
  AuthMiddleware.authenticate,
  validate(
    listItinerariesSchema,
  ),
  ItineraryController.listItineraries,
);

router.get(
  "/:itineraryId",
  AuthMiddleware.authenticate,
  validate(
    getItinerarySchema,
  ),
  ItineraryController.getItinerary,
);

router.post(
  "/",
  AuthMiddleware.authenticate,
  validate(
    saveItinerarySchema,
  ),
  ItineraryController.saveItinerary,
);

export default router;
