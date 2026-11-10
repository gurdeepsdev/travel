import { z } from "zod";

const emptyBody = z.object({}).strict().optional();
const emptyParams = z.object({}).strict();

export const listLanguagesSchema = z.object({
  body: emptyBody,
  params: emptyParams,
  query: z.object({
    itineraryId: z.string().trim().uuid(
      "Itinerary ID must be a valid UUID.",
    ).optional(),
  }).strict(),
});

export const setItineraryLanguageSchema = z.object({
  body: z.object({
    languageId: z.string().trim().uuid(
      "Language ID must be a valid UUID.",
    ),
  }).strict(),
  params: z.object({
    itineraryId: z.string().trim().uuid(
      "Itinerary ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const resetItineraryLanguageSchema = z.object({
  body: emptyBody,
  params: setItineraryLanguageSchema.shape.params,
  query: z.object({}).strict(),
});

export const listLessonsSchema = z.object({
  body: emptyBody,
  params: z.object({
    languageId: z.string().trim().uuid(
      "Language ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const getLessonCardsSchema = z.object({
  body: emptyBody,
  params: z.object({
    lessonId: z.string().trim().uuid(
      "Lesson ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const startLessonAttemptSchema = z.object({
  body: z.object({
    retry: z.boolean().default(false),
  }).strict(),
  params: z.object({
    lessonId: z.string().trim().uuid(
      "Lesson ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const getAttemptSchema = z.object({
  body: emptyBody,
  params: z.object({
    attemptId: z.string().trim().uuid(
      "Attempt ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const submitAttemptAnswerSchema = z.object({
  body: z.object({
    optionId: z.string().trim().uuid(
      "Option ID must be a valid UUID.",
    ),
    mode: z.enum(["QUIZ", "PRACTICE"]).default("QUIZ"),
  }).strict(),
  params: z.object({
    attemptId: z.string().trim().uuid(
      "Attempt ID must be a valid UUID.",
    ),
    questionId: z.string().trim().uuid(
      "Question ID must be a valid UUID.",
    ),
  }).strict(),
  query: z.object({}).strict(),
});

export const finishAttemptSchema = getAttemptSchema;

export const getAttemptResultSchema = getAttemptSchema;

export const reviewAttemptSchema = z.object({
  body: emptyBody,
  params: getAttemptSchema.shape.params,
  query: z.object({
    scope: z.enum(["INCORRECT"]).default("INCORRECT"),
  }).strict(),
});

export const getProgressSchema = z.object({
  body: emptyBody,
  params: emptyParams,
  query: z.object({
    languageId: z.string().trim().uuid(
      "Language ID must be a valid UUID.",
    ).optional(),
    itineraryId: z.string().trim().uuid(
      "Itinerary ID must be a valid UUID.",
    ).optional(),
  }).strict().refine(
    (query) => query.languageId || query.itineraryId,
    "Language ID or itinerary ID is required.",
  ),
});
