import { jest } from "@jest/globals";

const repositoryMock = {
  listPublishedLanguages: jest.fn(),
  findPublishedLanguage: jest.fn(),
  listPublishedLessons: jest.fn(),
  findPublishedLesson: jest.fn(),
  listLessonCards: jest.fn(),
  startOrResumeAttempt: jest.fn(),
  findOwnedAttempt: jest.fn(),
  listOwnedAttemptQuestions: jest.fn(),
  submitAnswer: jest.fn(),
  finishAttempt: jest.fn(),
  getItineraryLanguageContext: jest.fn(),
  setItineraryLanguage: jest.fn(),
  resetItineraryLanguage: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/lingua/lingua.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: service } = await import(
  "../../../src/modules/lingua/lingua.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const languageId = "33333333-3333-4333-8333-333333333333";
const attemptId = "55555555-5555-4555-8555-555555555555";

const language = {
  id: languageId,
  code: "fr",
  name: "French",
  native_name: "Français",
  display_order: 1,
  lesson_count: 5,
};

function context(overrides = {}) {
  return {
    itinerary_id: itineraryId,
    country_id: "44444444-4444-4444-8444-444444444444",
    country_name: "France",
    country_code: "FR",
    selected_language_id: languageId,
    selected_language_code: "fr",
    selected_language_name: "French",
    selected_language_native_name: "Français",
    selection_source: "ITINERARY",
    ...overrides,
  };
}

function attemptQuestionRows({ answered = false } = {}) {
  return Array.from({ length: 5 }, (_, questionIndex) =>
    Array.from({ length: 3 }, (_, optionIndex) => ({
      question_position: questionIndex + 1,
      question_id: `${questionIndex + 1}1111111-1111-4111-8111-111111111111`,
      question_type: "MEANING_RECOGNITION",
      prompt: `Question ${questionIndex + 1}`,
      phrase_id: `${questionIndex + 1}2222222-2222-4222-8222-222222222222`,
      target_text: `Phrase ${questionIndex + 1}`,
      option_position: optionIndex + 1,
      option_id: `${questionIndex + 1}${optionIndex + 1}333333-3333-4333-8333-333333333333`,
      option_text: `Option ${optionIndex + 1}`,
      selected_option_id: answered && optionIndex === 0
        ? `${questionIndex + 1}1333333-3333-4333-8333-333333333333`
        : null,
      answer_is_correct: answered ? true : null,
      answered_at: answered ? "2026-09-25T12:00:00.000Z" : null,
      explanation: answered ? "Explanation" : null,
      correct_option_id: answered
        ? `${questionIndex + 1}1333333-3333-4333-8333-333333333333`
        : null,
    })),
  ).flat();
}

describe("LinguaService language selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryMock.listPublishedLanguages.mockResolvedValue([language]);
    repositoryMock.findPublishedLanguage.mockResolvedValue(language);
    repositoryMock.listPublishedLessons.mockResolvedValue([]);
    repositoryMock.getItineraryLanguageContext.mockResolvedValue(context());
    repositoryMock.setItineraryLanguage.mockResolvedValue({ language_id: languageId });
    repositoryMock.resetItineraryLanguage.mockResolvedValue(true);
    repositoryMock.startOrResumeAttempt.mockResolvedValue({
      attemptId,
      created: true,
      resumed: false,
    });
    repositoryMock.findOwnedAttempt.mockResolvedValue({
      id: attemptId,
      lesson_id: itineraryId,
      status: "IN_PROGRESS",
      correct_count: null,
      question_count: null,
      started_at: "2026-09-25T12:00:00.000Z",
      completed_at: null,
      lesson_title: "Greetings",
      lesson_topic: "GREETINGS",
      lesson_version: 1,
      language_id: languageId,
      language_code: "fr",
      language_name: "French",
      language_native_name: "Français",
    });
    repositoryMock.listOwnedAttemptQuestions.mockResolvedValue(
      attemptQuestionRows(),
    );
    repositoryMock.submitAnswer.mockResolvedValue({
      created: true,
      idempotent: false,
      practice: false,
      persisted: true,
      answer: {
        question_id: itineraryId,
        selected_option_id: languageId,
        is_correct: false,
        correct_option_id: userId,
        explanation: "Use the greeting for this situation.",
        answered_at: "2026-09-25T13:00:00.000Z",
      },
    });
    repositoryMock.finishAttempt.mockResolvedValue({
      updated: true,
      correctCount: 5,
      questionCount: 5,
      completedAt: "2026-09-25T14:00:00.000Z",
    });
  });

  test("lists authenticated content with itinerary default selection", async () => {
    const result = await service.listLanguages({ itineraryId, userId });

    expect(result.languages).toEqual([{
      id: languageId,
      code: "fr",
      name: "French",
      nativeName: "Français",
      displayOrder: 1,
      lessonCount: 5,
    }]);
    expect(result.selection).toMatchObject({
      itineraryId,
      selectionSource: "ITINERARY",
      selectedLanguage: { id: languageId, code: "fr" },
    });
  });

  test("lists languages without requiring an itinerary", async () => {
    const result = await service.listLanguages({ userId });

    expect(repositoryMock.getItineraryLanguageContext).not.toHaveBeenCalled();
    expect(result.selection).toBeNull();
  });

  test("hides missing or inaccessible itineraries", async () => {
    repositoryMock.getItineraryLanguageContext.mockResolvedValue(null);

    await expect(
      service.listLanguages({ itineraryId, userId }),
    ).rejects.toMatchObject({
      code: "LINGUA.ITINERARY_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("persists a personal language override", async () => {
    repositoryMock.getItineraryLanguageContext
      .mockResolvedValueOnce(context())
      .mockResolvedValueOnce(context({ selection_source: "USER" }));

    const result = await service.setItineraryLanguage({
      itineraryId,
      userId,
      languageId,
    });

    expect(repositoryMock.setItineraryLanguage).toHaveBeenCalledWith({
      itineraryId,
      userId,
      languageId,
    });
    expect(result.selection.selectionSource).toBe("USER");
  });

  test("rejects draft, archived, and unknown languages", async () => {
    repositoryMock.findPublishedLanguage.mockResolvedValue(null);

    await expect(
      service.setItineraryLanguage({ itineraryId, userId, languageId }),
    ).rejects.toMatchObject({
      code: "LINGUA.LANGUAGE_NOT_FOUND",
      statusCode: 404,
    });
    expect(repositoryMock.setItineraryLanguage).not.toHaveBeenCalled();
  });

  test("resets an override to the itinerary-derived default", async () => {
    const result = await service.resetItineraryLanguage({
      itineraryId,
      userId,
    });

    expect(repositoryMock.resetItineraryLanguage).toHaveBeenCalledWith({
      itineraryId,
      userId,
    });
    expect(result.selection.selectionSource).toBe("ITINERARY");
  });

  test("returns an unresolved selection when no country mapping exists", async () => {
    repositoryMock.getItineraryLanguageContext.mockResolvedValue(context({
      country_id: null,
      country_name: null,
      country_code: null,
      selected_language_id: null,
      selected_language_code: null,
      selected_language_name: null,
      selected_language_native_name: null,
      selection_source: "NONE",
    }));

    const result = await service.listLanguages({ itineraryId, userId });

    expect(result.selection).toEqual({
      itineraryId,
      destination: null,
      selectedLanguage: null,
      selectionSource: "NONE",
    });
  });

  test("lists current lessons with personal version-specific progress", async () => {
    repositoryMock.listPublishedLessons.mockResolvedValue([{
      id: itineraryId,
      language_id: languageId,
      stable_key: "greetings",
      version: 1,
      title: "Greetings",
      topic: "GREETINGS",
      display_order: 1,
      published_at: "2026-09-25T10:00:00.000Z",
      completed_attempt_count: 2,
      best_score_percentage: "80.00",
      last_completed_at: "2026-09-25T11:00:00.000Z",
      in_progress_attempt_id: userId,
    }]);

    const result = await service.listLessons({ languageId, userId });

    expect(result.totalCount).toBe(1);
    expect(result.lessons[0]).toMatchObject({
      id: itineraryId,
      version: 1,
      progress: {
        completed: true,
        completedAttemptCount: 2,
        bestScorePercentage: 80,
        inProgressAttemptId: userId,
      },
    });
  });

  test("returns exactly five cards without question answer data", async () => {
    repositoryMock.findPublishedLesson.mockResolvedValue({
      id: itineraryId,
      language_id: languageId,
      stable_key: "greetings",
      version: 1,
      title: "Greetings",
      topic: "GREETINGS",
      display_order: 1,
      published_at: "2026-09-25T10:00:00.000Z",
      language_code: "fr",
      language_name: "French",
      language_native_name: "Français",
    });
    repositoryMock.listLessonCards.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: `${index + 1}1111111-1111-4111-8111-111111111111`,
        stable_key: `phrase-${index + 1}`,
        target_text: `Phrase ${index + 1}`,
        english_meaning: `Meaning ${index + 1}`,
        romanization: null,
        pronunciation_hint: null,
        regional_variant: null,
        audio_asset_id: index === 0 ? userId : null,
        audio_mime_type: index === 0 ? "audio/mpeg" : null,
        display_order: index + 1,
      })),
    );

    const result = await service.getLessonCards({ lessonId: itineraryId });

    expect(result.totalCount).toBe(5);
    expect(result.cards[0].audio).toEqual({
      assetId: userId,
      url: `/api/v1/media/assets/${userId}/content`,
      mimeType: "audio/mpeg",
    });
    expect(result.cards[0]).not.toHaveProperty("question");
  });

  test("hides incomplete or unpublished lesson cards", async () => {
    repositoryMock.findPublishedLesson.mockResolvedValue({
      id: itineraryId,
      language_id: languageId,
    });
    repositoryMock.listLessonCards.mockResolvedValue([]);

    await expect(
      service.getLessonCards({ lessonId: itineraryId }),
    ).rejects.toMatchObject({
      code: "LINGUA.LESSON_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("creates an attempt with ordered questions and no answer keys", async () => {
    const result = await service.startAttempt({
      lessonId: itineraryId,
      userId,
      retry: false,
    });

    expect(result).toMatchObject({
      created: true,
      resumed: false,
      attempt: { id: attemptId, status: "IN_PROGRESS", score: null },
      totalCount: 5,
      answeredCount: 0,
    });
    expect(result.questions[0].options).toHaveLength(3);
    expect(result.questions[0].answer).toBeNull();
    expect(result.questions[0].options[0]).not.toHaveProperty("correct");
  });

  test("resumes the one active attempt without reshuffling", async () => {
    repositoryMock.startOrResumeAttempt.mockResolvedValue({
      attemptId,
      created: false,
      resumed: true,
    });

    const result = await service.startAttempt({
      lessonId: itineraryId,
      userId,
      retry: false,
    });

    expect(result).toMatchObject({ created: false, resumed: true });
    expect(repositoryMock.listOwnedAttemptQuestions).toHaveBeenCalledWith(
      attemptId,
      userId,
    );
  });

  test.each([
    ["LESSON_NOT_FOUND", "LINGUA.LESSON_NOT_FOUND", 404],
    ["RETRY_REQUIRED", "LINGUA.RETRY_REQUIRED", 409],
    ["CONTENT_INVALID", "LINGUA.CONTENT_INVALID", 409],
  ])("maps attempt start failure %s", async (error, code, statusCode) => {
    repositoryMock.startOrResumeAttempt.mockResolvedValue({ error });

    await expect(service.startAttempt({
      lessonId: itineraryId,
      userId,
      retry: false,
    })).rejects.toMatchObject({ code, statusCode });
  });

  test("hides attempts owned by another user", async () => {
    repositoryMock.findOwnedAttempt.mockResolvedValue(null);

    await expect(service.getAttempt({ attemptId, userId }))
      .rejects.toMatchObject({
        code: "LINGUA.ATTEMPT_NOT_FOUND",
        statusCode: 404,
      });
  });

  test("returns feedback only for questions already answered", async () => {
    repositoryMock.listOwnedAttemptQuestions.mockResolvedValue(
      attemptQuestionRows({ answered: true }),
    );

    const result = await service.getAttempt({ attemptId, userId });

    expect(result.answeredCount).toBe(5);
    expect(result.questions[0].answer).toMatchObject({
      correct: true,
      explanation: "Explanation",
    });
  });

  test("submits the first immutable quiz answer", async () => {
    const result = await service.submitAnswer({
      attemptId,
      questionId: itineraryId,
      optionId: languageId,
      userId,
      mode: "QUIZ",
    });

    expect(repositoryMock.submitAnswer).toHaveBeenCalledWith({
      attemptId,
      questionId: itineraryId,
      optionId: languageId,
      userId,
      mode: "QUIZ",
    });
    expect(result).toMatchObject({
      created: true,
      idempotent: false,
      practice: false,
      persisted: true,
      answer: {
        questionId: itineraryId,
        selectedOptionId: languageId,
        correct: false,
        correctOptionId: userId,
      },
    });
  });

  test("returns idempotent success for the same saved answer", async () => {
    repositoryMock.submitAnswer.mockResolvedValue({
      created: false,
      idempotent: true,
      practice: false,
      persisted: true,
      answer: {
        question_id: itineraryId,
        selected_option_id: languageId,
        is_correct: false,
        correct_option_id: userId,
        explanation: "Explanation",
        answered_at: "2026-09-25T13:00:00.000Z",
      },
    });

    const result = await service.submitAnswer({
      attemptId,
      questionId: itineraryId,
      optionId: languageId,
      userId,
      mode: "QUIZ",
    });

    expect(result).toMatchObject({ created: false, idempotent: true });
  });

  test("checks practice without persisting or changing the original answer", async () => {
    repositoryMock.submitAnswer.mockResolvedValue({
      created: false,
      idempotent: false,
      practice: true,
      persisted: false,
      answer: {
        question_id: itineraryId,
        selected_option_id: userId,
        is_correct: true,
        correct_option_id: userId,
        explanation: "Explanation",
        answered_at: null,
      },
    });

    const result = await service.submitAnswer({
      attemptId,
      questionId: itineraryId,
      optionId: userId,
      userId,
      mode: "PRACTICE",
    });

    expect(result).toMatchObject({
      practice: true,
      persisted: false,
      answer: { correct: true, answeredAt: null },
    });
  });

  test.each([
    ["ATTEMPT_NOT_FOUND", "LINGUA.ATTEMPT_NOT_FOUND", 404],
    ["QUESTION_NOT_IN_ATTEMPT", "LINGUA.QUESTION_NOT_IN_ATTEMPT", 404],
    ["INVALID_OPTION", "LINGUA.INVALID_OPTION", 400],
    ["ANSWER_ALREADY_SUBMITTED", "LINGUA.ANSWER_ALREADY_SUBMITTED", 409],
    ["ATTEMPT_ALREADY_COMPLETED", "LINGUA.ATTEMPT_ALREADY_COMPLETED", 409],
    ["PRACTICE_NOT_ALLOWED", "LINGUA.PRACTICE_NOT_ALLOWED", 409],
  ])("maps answer failure %s", async (error, code, statusCode) => {
    repositoryMock.submitAnswer.mockResolvedValue({ error });

    await expect(service.submitAnswer({
      attemptId,
      questionId: itineraryId,
      optionId: languageId,
      userId,
      mode: "QUIZ",
    })).rejects.toMatchObject({ code, statusCode });
  });

  test("finishes a complete attempt using the server-calculated score", async () => {
    repositoryMock.findOwnedAttempt.mockResolvedValue({
      id: attemptId,
      lesson_id: itineraryId,
      status: "COMPLETED",
      correct_count: 5,
      question_count: 5,
      started_at: "2026-09-25T12:00:00.000Z",
      completed_at: "2026-09-25T14:00:00.000Z",
      lesson_title: "Greetings",
      lesson_topic: "GREETINGS",
      lesson_version: 1,
      language_id: languageId,
      language_code: "fr",
      language_name: "French",
      language_native_name: "Français",
    });
    repositoryMock.listOwnedAttemptQuestions.mockResolvedValue(
      attemptQuestionRows({ answered: true }),
    );

    const result = await service.finishAttempt({ attemptId, userId });

    expect(repositoryMock.finishAttempt).toHaveBeenCalledWith({
      attemptId,
      userId,
    });
    expect(result).toMatchObject({
      updated: true,
      result: {
        correctCount: 5,
        questionCount: 5,
        percentage: 100,
      },
    });
  });

  test("returns the same result when completion is repeated", async () => {
    repositoryMock.finishAttempt.mockResolvedValue({
      updated: false,
      correctCount: 5,
      questionCount: 5,
      completedAt: "2026-09-25T14:00:00.000Z",
    });
    repositoryMock.findOwnedAttempt.mockResolvedValue({
      id: attemptId,
      lesson_id: itineraryId,
      status: "COMPLETED",
      correct_count: 5,
      question_count: 5,
      started_at: "2026-09-25T12:00:00.000Z",
      completed_at: "2026-09-25T14:00:00.000Z",
      lesson_title: "Greetings",
      lesson_topic: "GREETINGS",
      lesson_version: 1,
      language_id: languageId,
      language_code: "fr",
      language_name: "French",
      language_native_name: "Français",
    });
    repositoryMock.listOwnedAttemptQuestions.mockResolvedValue(
      attemptQuestionRows({ answered: true }),
    );

    const result = await service.finishAttempt({ attemptId, userId });

    expect(result.updated).toBe(false);
    expect(result.result.percentage).toBe(100);
  });

  test("rejects incomplete completion with counts", async () => {
    repositoryMock.finishAttempt.mockResolvedValue({
      error: "ATTEMPT_INCOMPLETE",
      answeredCount: 4,
      questionCount: 5,
    });

    await expect(service.finishAttempt({ attemptId, userId }))
      .rejects.toMatchObject({
        code: "LINGUA.ATTEMPT_INCOMPLETE",
        statusCode: 422,
        details: { answeredCount: 4, questionCount: 5 },
      });
  });

  test("rejects result access before completion", async () => {
    await expect(service.getResult({ attemptId, userId }))
      .rejects.toMatchObject({
        code: "LINGUA.ATTEMPT_INCOMPLETE",
        statusCode: 422,
      });
  });

  test("reviews only incorrect original answers", async () => {
    repositoryMock.findOwnedAttempt.mockResolvedValue({
      id: attemptId,
      lesson_id: itineraryId,
      status: "COMPLETED",
      correct_count: 3,
      question_count: 5,
      started_at: "2026-09-25T12:00:00.000Z",
      completed_at: "2026-09-25T14:00:00.000Z",
      lesson_title: "Greetings",
      lesson_topic: "GREETINGS",
      lesson_version: 1,
      language_id: languageId,
      language_code: "fr",
      language_name: "French",
      language_native_name: "Français",
    });
    const rows = attemptQuestionRows({ answered: true }).map((row) => ({
      ...row,
      answer_is_correct: row.question_position > 2,
    }));
    repositoryMock.listOwnedAttemptQuestions.mockResolvedValue(rows);

    const result = await service.reviewAttempt({ attemptId, userId });

    expect(result.scope).toBe("INCORRECT");
    expect(result.totalCount).toBe(2);
    expect(result.questions.every(
      (question) => question.answer.correct === false,
    )).toBe(true);
  });

  test("summarizes personal progress for an explicit language", async () => {
    repositoryMock.listPublishedLessons.mockResolvedValue([
      {
        id: itineraryId,
        language_id: languageId,
        stable_key: "greetings",
        version: 1,
        title: "Greetings",
        topic: "GREETINGS",
        display_order: 1,
        published_at: "2026-09-25T10:00:00.000Z",
        completed_attempt_count: 1,
        best_score_percentage: "80.00",
        last_completed_at: "2026-09-25T11:00:00.000Z",
        in_progress_attempt_id: null,
      },
      {
        id: attemptId,
        language_id: languageId,
        stable_key: "transport",
        version: 1,
        title: "Transport",
        topic: "TRANSPORT",
        display_order: 2,
        published_at: "2026-09-25T10:00:00.000Z",
        completed_attempt_count: 0,
        best_score_percentage: null,
        last_completed_at: null,
        in_progress_attempt_id: userId,
      },
    ]);

    const result = await service.getProgress({ languageId, userId });

    expect(result.summary).toEqual({
      totalLessons: 2,
      completedLessons: 1,
      incompleteLessons: 1,
      inProgressLessons: 1,
      completionPercentage: 50,
    });
  });

  test("uses the authenticated user's itinerary language selection", async () => {
    const result = await service.getProgress({ itineraryId, userId });

    expect(repositoryMock.listPublishedLessons).toHaveBeenCalledWith({
      languageId,
      userId,
    });
    expect(result.selection).toMatchObject({
      itineraryId,
      selectionSource: "ITINERARY",
    });
  });

  test("requires a resolved language for itinerary progress", async () => {
    repositoryMock.getItineraryLanguageContext.mockResolvedValue(context({
      selected_language_id: null,
      selected_language_code: null,
      selected_language_name: null,
      selected_language_native_name: null,
      selection_source: "NONE",
    }));

    await expect(service.getProgress({ itineraryId, userId }))
      .rejects.toMatchObject({
        code: "LINGUA.LANGUAGE_SELECTION_REQUIRED",
        statusCode: 400,
      });
  });
});
