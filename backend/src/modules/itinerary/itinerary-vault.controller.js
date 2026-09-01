import Response from "../../core/response/index.js";
import ItineraryVaultService from "./itinerary-vault.service.js";

class ItineraryVaultController {
  async uploadDocument(req, res, next) {
    try {
      const result =
        await ItineraryVaultService
          .uploadDocument({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId: req.user.id,
            input: req.validated.body,
            documentFile: req.file,
            logger: req.logger,
          });
      return Response.created(
        res,
        result,
        "Vault document uploaded successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const result =
        await ItineraryVaultService
          .listDocuments({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId: req.user.id,
            documentType:
              req.validated.query
                .documentType,
          });
      return Response.success(
        res,
        result,
        "Vault documents fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const result =
        await ItineraryVaultService
          .deleteDocument({
            itineraryId:
              req.validated.params
                .itineraryId,
            documentId:
              req.validated.params
                .documentId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Vault document deleted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ItineraryVaultController();
