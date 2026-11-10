import { z } from "zod";

const keySchema = z.string().trim().min(1).max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const optionSchema = z.object({
  stableKey: keySchema,
  text: z.string().trim().min(1),
  correct: z.boolean(),
  displayOrder: z.number().int().min(1).max(3),
}).strict();

const questionSchema = z.object({
  type: z.enum(["MEANING_RECOGNITION", "SITUATION_TO_PHRASE"]),
  prompt: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  explanationLanguage: z.string().trim().min(2).max(10).default("en"),
  options: z.array(optionSchema).length(3),
}).strict().superRefine((question, context) => {
  if (question.options.filter((option) => option.correct).length !== 1) {
    context.addIssue({
      code: "custom",
      message: "A question must contain exactly one correct option.",
      path: ["options"],
    });
  }
  if (new Set(question.options.map((option) => option.displayOrder)).size !== 3) {
    context.addIssue({
      code: "custom",
      message: "Question option display orders must be unique.",
      path: ["options"],
    });
  }
});

const phraseSchema = z.object({
  stableKey: keySchema,
  targetText: z.string().trim().min(1),
  englishMeaning: z.string().trim().min(1),
  romanization: z.string().trim().min(1).nullable().optional(),
  pronunciationHint: z.string().trim().min(1).nullable().optional(),
  regionalVariant: z.string().trim().min(1).max(100).nullable().optional(),
  audioAssetId: z.string().trim().uuid().nullable().optional(),
  displayOrder: z.number().int().min(1).max(5),
  question: questionSchema,
}).strict();

const lessonSchema = z.object({
  stableKey: keySchema,
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  topic: z.enum(["GREETINGS", "TRANSPORT", "HOTEL", "FOOD", "HELP"]),
  displayOrder: z.number().int().min(1).max(5),
  phrases: z.array(phraseSchema).length(5),
}).strict().superRefine((lesson, context) => {
  if (new Set(lesson.phrases.map((phrase) => phrase.stableKey)).size !== 5) {
    context.addIssue({
      code: "custom",
      message: "Phrase stable keys must be unique within a lesson.",
      path: ["phrases"],
    });
  }
  if (new Set(lesson.phrases.map((phrase) => phrase.displayOrder)).size !== 5) {
    context.addIssue({
      code: "custom",
      message: "Phrase display orders must be unique within a lesson.",
      path: ["phrases"],
    });
  }
});

export const linguaContentSchema = z.object({
  language: z.object({
    code: z.enum(["fr", "es", "en", "it", "tr", "de", "ja", "th", "pt", "ar"]),
    name: z.string().trim().min(1).max(100),
    nativeName: z.string().trim().min(1).max(100),
    displayOrder: z.number().int().min(1).max(10),
    defaultCountryCodes: z.array(
      z.string().trim().min(2).max(10).transform((code) => code.toUpperCase()),
    ).default([]),
  }).strict(),
  lessons: z.array(lessonSchema).length(5),
}).strict().superRefine((content, context) => {
  const topics = new Set(content.lessons.map((lesson) => lesson.topic));
  const orders = new Set(content.lessons.map((lesson) => lesson.displayOrder));
  const keys = new Set(content.lessons.map((lesson) => lesson.stableKey));

  if (topics.size !== 5 || orders.size !== 5 || keys.size !== 5) {
    context.addIssue({
      code: "custom",
      message: "Lessons require five unique topics, keys, and display orders.",
      path: ["lessons"],
    });
  }

  if (
    content.language.code === "en"
    && content.lessons.some((lesson) => lesson.phrases.some(
      (phrase) => phrase.question.type !== "SITUATION_TO_PHRASE",
    ))
  ) {
    context.addIssue({
      code: "custom",
      message: "English content must use situation-to-phrase questions.",
      path: ["lessons"],
    });
  }
});
