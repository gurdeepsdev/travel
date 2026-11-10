import AppError from "../../core/errors/app-error.js";
import HttpStatus from "../../shared/constants/http-status.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import LinguaRepository from "./lingua.repository.js";

function mapLanguage(language) {
  return {
    id: language.id,
    code: language.code,
    name: language.name,
    nativeName: language.native_name,
    displayOrder: language.display_order,
    lessonCount: language.lesson_count ?? undefined,
  };
}

function mapContext(context) {
  return {
    itineraryId: context.itinerary_id,
    destination: context.country_id ? {
      countryId: context.country_id,
      countryName: context.country_name,
      countryCode: context.country_code,
    } : null,
    selectedLanguage: context.selected_language_id ? {
      id: context.selected_language_id,
      code: context.selected_language_code,
      name: context.selected_language_name,
      nativeName: context.selected_language_native_name,
    } : null,
    selectionSource: context.selection_source,
  };
}

function mapLesson(lesson) {
  const completedAttemptCount = lesson.completed_attempt_count ?? 0;

  return {
    id: lesson.id,
    languageId: lesson.language_id,
    stableKey: lesson.stable_key,
    version: lesson.version,
    title: lesson.title,
    topic: lesson.topic,
    displayOrder: lesson.display_order,
    publishedAt: lesson.published_at,
    progress: {
      completed: completedAttemptCount > 0,
      completedAttemptCount,
      bestScorePercentage: lesson.best_score_percentage === null
        || lesson.best_score_percentage === undefined
        ? null
        : Number(lesson.best_score_percentage),
      lastCompletedAt: lesson.last_completed_at ?? null,
      inProgressAttemptId: lesson.in_progress_attempt_id ?? null,
    },
  };
}

function mapCard(phrase) {
  return {
    id: phrase.id,
    stableKey: phrase.stable_key,
    targetText: phrase.target_text,
    englishMeaning: phrase.english_meaning,
    romanization: phrase.romanization,
    pronunciationHint: phrase.pronunciation_hint,
    regionalVariant: phrase.regional_variant,
    displayOrder: phrase.display_order,
    audio: phrase.audio_asset_id && phrase.audio_mime_type ? {
      assetId: phrase.audio_asset_id,
      url: `/api/v1/media/assets/${phrase.audio_asset_id}/content`,
      mimeType: phrase.audio_mime_type,
    } : null,
  };
}

function mapAttemptQuestions(rows) {
  const questions = new Map();

  for (const row of rows) {
    if (!questions.has(row.question_id)) {
      questions.set(row.question_id, {
        position: row.question_position,
        id: row.question_id,
        type: row.question_type,
        prompt: row.prompt,
        phrase: {
          id: row.phrase_id,
          targetText: row.target_text,
        },
        options: [],
        answer: row.selected_option_id ? {
          selectedOptionId: row.selected_option_id,
          correct: row.answer_is_correct,
          correctOptionId: row.correct_option_id,
          explanation: row.explanation,
          answeredAt: row.answered_at,
        } : null,
      });
    }

    questions.get(row.question_id).options.push({
      position: row.option_position,
      id: row.option_id,
      text: row.option_text,
    });
  }

  return [...questions.values()];
}

class LinguaService {
  createItineraryNotFoundError() {
    return new AppError({
      code: ErrorCodes.LINGUA.ITINERARY_NOT_FOUND,
      message: "Itinerary not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createLanguageNotFoundError() {
    return new AppError({
      code: ErrorCodes.LINGUA.LANGUAGE_NOT_FOUND,
      message: "Published language not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createLessonNotFoundError() {
    return new AppError({
      code: ErrorCodes.LINGUA.LESSON_NOT_FOUND,
      message: "Published lesson not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createAttemptNotFoundError() {
    return new AppError({
      code: ErrorCodes.LINGUA.ATTEMPT_NOT_FOUND,
      message: "Attempt not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  async requireItineraryContext({ itineraryId, userId }) {
    const context = await LinguaRepository.getItineraryLanguageContext({
      itineraryId,
      userId,
    });

    if (!context) {
      throw this.createItineraryNotFoundError();
    }

    return context;
  }

  async listLanguages({ itineraryId, userId }) {
    const languages = await LinguaRepository.listPublishedLanguages();
    const context = itineraryId
      ? await this.requireItineraryContext({ itineraryId, userId })
      : null;

    return {
      languages: languages.map(mapLanguage),
      selection: context ? mapContext(context) : null,
    };
  }

  async setItineraryLanguage({ itineraryId, userId, languageId }) {
    await this.requireItineraryContext({ itineraryId, userId });

    const language = await LinguaRepository.findPublishedLanguage(languageId);
    if (!language) {
      throw this.createLanguageNotFoundError();
    }

    const updated = await LinguaRepository.setItineraryLanguage({
      itineraryId,
      userId,
      languageId,
    });

    if (!updated) {
      throw this.createItineraryNotFoundError();
    }

    const context = await this.requireItineraryContext({ itineraryId, userId });
    return { selection: mapContext(context) };
  }

  async resetItineraryLanguage({ itineraryId, userId }) {
    await this.requireItineraryContext({ itineraryId, userId });
    await LinguaRepository.resetItineraryLanguage({ itineraryId, userId });

    const context = await this.requireItineraryContext({ itineraryId, userId });
    return { selection: mapContext(context) };
  }

  async listLessons({ languageId, userId }) {
    const language = await LinguaRepository.findPublishedLanguage(languageId);
    if (!language) {
      throw this.createLanguageNotFoundError();
    }

    const lessons = await LinguaRepository.listPublishedLessons({
      languageId,
      userId,
    });

    return {
      language: mapLanguage(language),
      lessons: lessons.map(mapLesson),
      totalCount: lessons.length,
    };
  }

  async getLessonCards({ lessonId }) {
    const lesson = await LinguaRepository.findPublishedLesson(lessonId);
    if (!lesson) {
      throw this.createLessonNotFoundError();
    }

    const cards = await LinguaRepository.listLessonCards(lessonId);
    if (cards.length !== 5) {
      throw this.createLessonNotFoundError();
    }

    return {
      language: {
        id: lesson.language_id,
        code: lesson.language_code,
        name: lesson.language_name,
        nativeName: lesson.language_native_name,
      },
      lesson: {
        id: lesson.id,
        stableKey: lesson.stable_key,
        version: lesson.version,
        title: lesson.title,
        topic: lesson.topic,
        displayOrder: lesson.display_order,
        publishedAt: lesson.published_at,
      },
      cards: cards.map(mapCard),
      totalCount: cards.length,
    };
  }

  async getAttempt({ attemptId, userId }) {
    const attempt = await LinguaRepository.findOwnedAttempt(attemptId, userId);
    if (!attempt) {
      throw this.createAttemptNotFoundError();
    }

    const questionRows = await LinguaRepository.listOwnedAttemptQuestions(
      attemptId,
      userId,
    );
    const questions = mapAttemptQuestions(questionRows);

    if (questions.length !== 5) {
      throw new AppError({
        code: ErrorCodes.LINGUA.CONTENT_INVALID,
        message: "Attempt content is invalid.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        score: attempt.status === "COMPLETED" ? {
          correctCount: attempt.correct_count,
          questionCount: attempt.question_count,
          percentage: Number((
            attempt.correct_count / attempt.question_count * 100
          ).toFixed(2)),
        } : null,
      },
      language: {
        id: attempt.language_id,
        code: attempt.language_code,
        name: attempt.language_name,
        nativeName: attempt.language_native_name,
      },
      lesson: {
        id: attempt.lesson_id,
        title: attempt.lesson_title,
        topic: attempt.lesson_topic,
        version: attempt.lesson_version,
      },
      questions,
      totalCount: questions.length,
      answeredCount: questions.filter((question) => question.answer).length,
    };
  }

  async startAttempt({ lessonId, userId, retry }) {
    const result = await LinguaRepository.startOrResumeAttempt({
      lessonId,
      userId,
      retry,
    });

    if (result.error === "LESSON_NOT_FOUND") {
      throw this.createLessonNotFoundError();
    }
    if (result.error === "RETRY_REQUIRED") {
      throw new AppError({
        code: ErrorCodes.LINGUA.RETRY_REQUIRED,
        message: "Set retry to true to start another attempt.",
        statusCode: HttpStatus.CONFLICT,
      });
    }
    if (result.error === "CONTENT_INVALID") {
      throw new AppError({
        code: ErrorCodes.LINGUA.CONTENT_INVALID,
        message: "Published lesson content is invalid.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    const payload = await this.getAttempt({
      attemptId: result.attemptId,
      userId,
    });

    return {
      created: result.created,
      resumed: result.resumed,
      ...payload,
    };
  }

  async submitAnswer({
    attemptId,
    questionId,
    optionId,
    userId,
    mode,
  }) {
    const result = await LinguaRepository.submitAnswer({
      attemptId,
      questionId,
      optionId,
      userId,
      mode,
    });

    const failures = {
      ATTEMPT_NOT_FOUND: {
        code: ErrorCodes.LINGUA.ATTEMPT_NOT_FOUND,
        message: "Attempt not found.",
        statusCode: HttpStatus.NOT_FOUND,
      },
      QUESTION_NOT_IN_ATTEMPT: {
        code: ErrorCodes.LINGUA.QUESTION_NOT_IN_ATTEMPT,
        message: "Question does not belong to this attempt.",
        statusCode: HttpStatus.NOT_FOUND,
      },
      INVALID_OPTION: {
        code: ErrorCodes.LINGUA.INVALID_OPTION,
        message: "Option does not belong to this question.",
        statusCode: HttpStatus.BAD_REQUEST,
      },
      ANSWER_ALREADY_SUBMITTED: {
        code: ErrorCodes.LINGUA.ANSWER_ALREADY_SUBMITTED,
        message: "The first answer for this question is immutable.",
        statusCode: HttpStatus.CONFLICT,
      },
      ATTEMPT_ALREADY_COMPLETED: {
        code: ErrorCodes.LINGUA.ATTEMPT_ALREADY_COMPLETED,
        message: "Completed attempts cannot accept new quiz answers.",
        statusCode: HttpStatus.CONFLICT,
      },
      PRACTICE_NOT_ALLOWED: {
        code: ErrorCodes.LINGUA.PRACTICE_NOT_ALLOWED,
        message: "Practice is available only for an incorrectly answered question.",
        statusCode: HttpStatus.CONFLICT,
      },
    };

    if (result.error) {
      throw new AppError(failures[result.error]);
    }

    return {
      created: result.created,
      idempotent: result.idempotent,
      practice: result.practice,
      persisted: result.persisted,
      answer: {
        questionId: result.answer.question_id,
        selectedOptionId: result.answer.selected_option_id,
        correct: result.answer.is_correct,
        correctOptionId: result.answer.correct_option_id,
        explanation: result.answer.explanation,
        answeredAt: result.answer.answered_at,
      },
    };
  }

  async getResult({ attemptId, userId }) {
    const payload = await this.getAttempt({ attemptId, userId });

    if (payload.attempt.status !== "COMPLETED") {
      throw new AppError({
        code: ErrorCodes.LINGUA.ATTEMPT_INCOMPLETE,
        message: "Complete the attempt before requesting its result.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        details: {
          answeredCount: payload.answeredCount,
          questionCount: payload.totalCount,
        },
      });
    }

    return {
      ...payload,
      result: payload.attempt.score,
    };
  }

  async finishAttempt({ attemptId, userId }) {
    const completion = await LinguaRepository.finishAttempt({
      attemptId,
      userId,
    });

    if (completion.error === "ATTEMPT_NOT_FOUND") {
      throw this.createAttemptNotFoundError();
    }
    if (completion.error === "ATTEMPT_INCOMPLETE") {
      throw new AppError({
        code: ErrorCodes.LINGUA.ATTEMPT_INCOMPLETE,
        message: "Answer every question before completing the attempt.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        details: {
          answeredCount: completion.answeredCount,
          questionCount: completion.questionCount,
        },
      });
    }

    const result = await this.getResult({ attemptId, userId });
    return {
      updated: completion.updated,
      ...result,
    };
  }

  async reviewAttempt({ attemptId, userId }) {
    const result = await this.getResult({ attemptId, userId });
    const questions = result.questions.filter(
      (question) => question.answer?.correct === false,
    );

    return {
      attemptId,
      scope: "INCORRECT",
      questions,
      totalCount: questions.length,
    };
  }

  async getProgress({ languageId, itineraryId, userId }) {
    let resolvedLanguageId = languageId;
    let selection = null;

    if (itineraryId) {
      const context = await this.requireItineraryContext({ itineraryId, userId });
      selection = mapContext(context);
      resolvedLanguageId ??= context.selected_language_id;
    }

    if (!resolvedLanguageId) {
      throw new AppError({
        code: ErrorCodes.LINGUA.LANGUAGE_SELECTION_REQUIRED,
        message: "Select a published language before requesting progress.",
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const progress = await this.listLessons({
      languageId: resolvedLanguageId,
      userId,
    });
    const completedLessons = progress.lessons.filter(
      (lesson) => lesson.progress.completed,
    ).length;
    const inProgressLessons = progress.lessons.filter(
      (lesson) => lesson.progress.inProgressAttemptId !== null,
    ).length;

    return {
      language: progress.language,
      selection,
      lessons: progress.lessons,
      summary: {
        totalLessons: progress.lessons.length,
        completedLessons,
        incompleteLessons: progress.lessons.length - completedLessons,
        inProgressLessons,
        completionPercentage: progress.lessons.length === 0
          ? 0
          : Number((completedLessons / progress.lessons.length * 100).toFixed(2)),
      },
    };
  }
}

export default new LinguaService();
