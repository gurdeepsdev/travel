import { Router } from "express";
import AuthMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import LinguaController from "./lingua.controller.js";
import {
  finishAttemptSchema,
  getAttemptSchema,
  getAttemptResultSchema,
  getProgressSchema,
  getLessonCardsSchema,
  listLanguagesSchema,
  listLessonsSchema,
  resetItineraryLanguageSchema,
  reviewAttemptSchema,
  startLessonAttemptSchema,
  submitAttemptAnswerSchema,
  setItineraryLanguageSchema,
} from "./lingua.validation.js";

const router = Router();

router.get(
  "/languages",
  AuthMiddleware.authenticate,
  validate(listLanguagesSchema),
  LinguaController.listLanguages,
);

router.get(
  "/progress",
  AuthMiddleware.authenticate,
  validate(getProgressSchema),
  LinguaController.getProgress,
);

router.get(
  "/languages/:languageId/lessons",
  AuthMiddleware.authenticate,
  validate(listLessonsSchema),
  LinguaController.listLessons,
);

router.get(
  "/lessons/:lessonId/cards",
  AuthMiddleware.authenticate,
  validate(getLessonCardsSchema),
  LinguaController.getLessonCards,
);

router.post(
  "/lessons/:lessonId/attempts",
  AuthMiddleware.authenticate,
  validate(startLessonAttemptSchema),
  LinguaController.startAttempt,
);

router.get(
  "/attempts/:attemptId",
  AuthMiddleware.authenticate,
  validate(getAttemptSchema),
  LinguaController.getAttempt,
);

router.post(
  "/attempts/:attemptId/questions/:questionId/answers",
  AuthMiddleware.authenticate,
  validate(submitAttemptAnswerSchema),
  LinguaController.submitAnswer,
);

router.post(
  "/attempts/:attemptId/finish",
  AuthMiddleware.authenticate,
  validate(finishAttemptSchema),
  LinguaController.finishAttempt,
);

router.get(
  "/attempts/:attemptId/result",
  AuthMiddleware.authenticate,
  validate(getAttemptResultSchema),
  LinguaController.getResult,
);

router.get(
  "/attempts/:attemptId/review",
  AuthMiddleware.authenticate,
  validate(reviewAttemptSchema),
  LinguaController.reviewAttempt,
);

router.put(
  "/itineraries/:itineraryId/language",
  AuthMiddleware.authenticate,
  validate(setItineraryLanguageSchema),
  LinguaController.setItineraryLanguage,
);

router.delete(
  "/itineraries/:itineraryId/language",
  AuthMiddleware.authenticate,
  validate(resetItineraryLanguageSchema),
  LinguaController.resetItineraryLanguage,
);

export default router;
