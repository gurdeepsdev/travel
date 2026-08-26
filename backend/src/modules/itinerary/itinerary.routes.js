import {
  Router,
} from "express";

import AuthMiddleware
  from "../../middleware/auth.middleware.js";
import validate
  from "../../middleware/validate.middleware.js";

import ItineraryController
  from "./itinerary.controller.js";
import ItineraryVaultController
  from "./itinerary-vault.controller.js";
import itineraryVaultUploadMiddleware
  from "./itinerary-vault-upload.middleware.js";
import {
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
  updateItineraryStatusSchema,
  uploadVaultDocumentSchema,
  listVaultDocumentsSchema,
} from "./itinerary.validation.js";

const router = Router();

router.get(
  "/completed",
  AuthMiddleware.authenticate,
  validate(
    listItinerariesSchema,
  ),
  ItineraryController
    .listCompletedItineraries,
);

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

router.patch(
  "/:itineraryId/status",
  AuthMiddleware.authenticate,
  validate(
    updateItineraryStatusSchema,
  ),
  ItineraryController
    .updateItineraryStatus,
);

router.post(
  "/:itineraryId/vault/documents",
  AuthMiddleware.authenticate,
  itineraryVaultUploadMiddleware,
  validate(uploadVaultDocumentSchema),
  ItineraryVaultController
    .uploadDocument,
);

router.get(
  "/:itineraryId/vault/documents",
  AuthMiddleware.authenticate,
  validate(listVaultDocumentsSchema),
  ItineraryVaultController
    .listDocuments,
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
