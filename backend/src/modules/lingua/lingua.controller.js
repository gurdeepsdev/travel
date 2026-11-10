import Response from "../../core/response/index.js";
import LinguaService from "./lingua.service.js";

class LinguaController {
  async listLanguages(req, res, next) {
    try {
      const result = await LinguaService.listLanguages({
        itineraryId: req.validated.query.itineraryId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail languages fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async setItineraryLanguage(req, res, next) {
    try {
      const result = await LinguaService.setItineraryLanguage({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        languageId: req.validated.body.languageId,
      });

      return Response.success(
        res,
        result,
        "Itinerary language updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async resetItineraryLanguage(req, res, next) {
    try {
      const result = await LinguaService.resetItineraryLanguage({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "Itinerary language reset successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listLessons(req, res, next) {
    try {
      const result = await LinguaService.listLessons({
        languageId: req.validated.params.languageId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail lessons fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getLessonCards(req, res, next) {
    try {
      const result = await LinguaService.getLessonCards({
        lessonId: req.validated.params.lessonId,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail learning cards fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async startAttempt(req, res, next) {
    try {
      const result = await LinguaService.startAttempt({
        lessonId: req.validated.params.lessonId,
        userId: req.user.id,
        retry: req.validated.body.retry,
      });

      if (result.created) {
        return Response.created(
          res,
          result,
          "LinguaTrail attempt created successfully.",
        );
      }

      return Response.success(
        res,
        result,
        "LinguaTrail attempt resumed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getAttempt(req, res, next) {
    try {
      const result = await LinguaService.getAttempt({
        attemptId: req.validated.params.attemptId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail attempt fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async submitAnswer(req, res, next) {
    try {
      const result = await LinguaService.submitAnswer({
        attemptId: req.validated.params.attemptId,
        questionId: req.validated.params.questionId,
        optionId: req.validated.body.optionId,
        userId: req.user.id,
        mode: req.validated.body.mode,
      });

      return Response.success(
        res,
        result,
        result.practice
          ? "Practice answer checked successfully."
          : "LinguaTrail answer saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async finishAttempt(req, res, next) {
    try {
      const result = await LinguaService.finishAttempt({
        attemptId: req.validated.params.attemptId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail attempt completed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getResult(req, res, next) {
    try {
      const result = await LinguaService.getResult({
        attemptId: req.validated.params.attemptId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail result fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async reviewAttempt(req, res, next) {
    try {
      const result = await LinguaService.reviewAttempt({
        attemptId: req.validated.params.attemptId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "Incorrect LinguaTrail answers fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getProgress(req, res, next) {
    try {
      const result = await LinguaService.getProgress({
        languageId: req.validated.query.languageId,
        itineraryId: req.validated.query.itineraryId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "LinguaTrail progress fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new LinguaController();
