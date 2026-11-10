import Database from "../../database/database-manager.js";
import { randomInt } from "node:crypto";

const itineraryAccessSql = `
  itinerary_record.created_by = $2::uuid
  OR EXISTS (
    SELECT 1
    FROM groups.groups user_group
    INNER JOIN groups.group_members member
      ON member.group_id = user_group.id
      AND member.user_id = $2::uuid
      AND member.status = 'ACTIVE'
    WHERE user_group.itinerary_id = itinerary_record.id
      AND user_group.status = 'ACTIVE'
      AND user_group.deleted_at IS NULL
  )
`;

function shuffle(values) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

class LinguaRepository {
  async listPublishedLanguages() {
    const { rows } = await Database.query(`
      SELECT
        language.id,
        language.code,
        language.name,
        language.native_name,
        language.display_order,
        COUNT(DISTINCT lesson.stable_key)::integer AS lesson_count
      FROM lingua.languages language
      LEFT JOIN lingua.lessons lesson
        ON lesson.language_id = language.id
        AND lesson.status = 'PUBLISHED'
        AND NOT EXISTS (
          SELECT 1
          FROM lingua.lessons newer_lesson
          WHERE newer_lesson.language_id = lesson.language_id
            AND newer_lesson.stable_key = lesson.stable_key
            AND newer_lesson.status = 'PUBLISHED'
            AND newer_lesson.version > lesson.version
        )
      WHERE language.status = 'PUBLISHED'
      GROUP BY
        language.id,
        language.code,
        language.name,
        language.native_name,
        language.display_order
      ORDER BY language.display_order, language.id
    `);

    return rows;
  }

  async findPublishedLanguage(languageId) {
    const { rows } = await Database.query(`
      SELECT id, code, name, native_name, display_order
      FROM lingua.languages
      WHERE id = $1::uuid
        AND status = 'PUBLISHED'
      LIMIT 1
    `, [languageId]);

    return rows[0] ?? null;
  }

  async listPublishedLessons({ languageId, userId }) {
    const { rows } = await Database.query(`
      WITH current_lessons AS (
        SELECT DISTINCT ON (lesson.stable_key)
          lesson.id,
          lesson.language_id,
          lesson.stable_key,
          lesson.version,
          lesson.title,
          lesson.topic,
          lesson.display_order,
          lesson.published_at
        FROM lingua.lessons lesson
        WHERE lesson.language_id = $1::uuid
          AND lesson.status = 'PUBLISHED'
        ORDER BY lesson.stable_key, lesson.version DESC
      ), attempt_summary AS (
        SELECT
          attempt.lesson_id,
          COUNT(*) FILTER (
            WHERE attempt.status = 'COMPLETED'
          )::integer AS completed_attempt_count,
          MAX(
            CASE
              WHEN attempt.status = 'COMPLETED'
                THEN ROUND(
                  attempt.correct_count::numeric /
                  NULLIF(attempt.question_count, 0) * 100,
                  2
                )
            END
          ) AS best_score_percentage,
          MAX(attempt.completed_at) AS last_completed_at,
          (
            ARRAY_AGG(
              attempt.id
              ORDER BY attempt.started_at DESC, attempt.id DESC
            ) FILTER (
              WHERE attempt.status = 'IN_PROGRESS'
            )
          )[1] AS in_progress_attempt_id
        FROM lingua.attempts attempt
        WHERE attempt.user_id = $2::uuid
        GROUP BY attempt.lesson_id
      )
      SELECT
        lesson.*,
        COALESCE(summary.completed_attempt_count, 0)
          AS completed_attempt_count,
        summary.best_score_percentage,
        summary.last_completed_at,
        summary.in_progress_attempt_id
      FROM current_lessons lesson
      LEFT JOIN attempt_summary summary
        ON summary.lesson_id = lesson.id
      ORDER BY lesson.display_order, lesson.id
    `, [languageId, userId]);

    return rows;
  }

  async findPublishedLesson(lessonId) {
    const { rows } = await Database.query(`
      SELECT
        lesson.id,
        lesson.language_id,
        lesson.stable_key,
        lesson.version,
        lesson.title,
        lesson.topic,
        lesson.display_order,
        lesson.published_at,
        language.code AS language_code,
        language.name AS language_name,
        language.native_name AS language_native_name
      FROM lingua.lessons lesson
      JOIN lingua.languages language
        ON language.id = lesson.language_id
        AND language.status = 'PUBLISHED'
      WHERE lesson.id = $1::uuid
        AND lesson.status = 'PUBLISHED'
      LIMIT 1
    `, [lessonId]);

    return rows[0] ?? null;
  }

  async listLessonCards(lessonId) {
    const { rows } = await Database.query(`
      SELECT
        phrase.id,
        phrase.stable_key,
        phrase.target_text,
        phrase.english_meaning,
        phrase.romanization,
        phrase.pronunciation_hint,
        phrase.regional_variant,
        phrase.audio_asset_id,
        phrase.display_order,
        asset.mime_type AS audio_mime_type
      FROM lingua.phrases phrase
      LEFT JOIN media.assets asset
        ON asset.id = phrase.audio_asset_id
        AND asset.deleted_at IS NULL
        AND asset.is_public IS TRUE
        AND asset.mime_type LIKE 'audio/%'
      WHERE phrase.lesson_id = $1::uuid
      ORDER BY phrase.display_order, phrase.id
    `, [lessonId]);

    return rows;
  }

  async startOrResumeAttempt({ lessonId, userId, retry }) {
    return Database.transaction(async (client) => {
      await client.query(`
        SELECT pg_advisory_xact_lock(
          hashtextextended($1::text || ':' || $2::text, 0)
        )
      `, [userId, lessonId]);

      const lessonResult = await client.query(`
        SELECT lesson.id
        FROM lingua.lessons lesson
        JOIN lingua.languages language
          ON language.id = lesson.language_id
          AND language.status = 'PUBLISHED'
        WHERE lesson.id = $1::uuid
          AND lesson.status = 'PUBLISHED'
        LIMIT 1
      `, [lessonId]);

      if (!lessonResult.rows[0]) {
        return { error: "LESSON_NOT_FOUND" };
      }

      const activeResult = await client.query(`
        SELECT id
        FROM lingua.attempts
        WHERE user_id = $1::uuid
          AND lesson_id = $2::uuid
          AND status = 'IN_PROGRESS'
        LIMIT 1
        FOR UPDATE
      `, [userId, lessonId]);

      if (activeResult.rows[0]) {
        return {
          attemptId: activeResult.rows[0].id,
          created: false,
          resumed: true,
        };
      }

      if (!retry) {
        const completedResult = await client.query(`
          SELECT 1
          FROM lingua.attempts
          WHERE user_id = $1::uuid
            AND lesson_id = $2::uuid
            AND status = 'COMPLETED'
          LIMIT 1
        `, [userId, lessonId]);

        if (completedResult.rows[0]) {
          return { error: "RETRY_REQUIRED" };
        }
      }

      const contentResult = await client.query(`
        SELECT
          question.id AS question_id,
          question_option.id AS option_id
        FROM lingua.phrases phrase
        JOIN lingua.questions question
          ON question.phrase_id = phrase.id
        JOIN lingua.question_options question_option
          ON question_option.question_id = question.id
        WHERE phrase.lesson_id = $1::uuid
        ORDER BY
          phrase.display_order,
          question_option.display_order
      `, [lessonId]);

      const questions = new Map();
      for (const row of contentResult.rows) {
        if (!questions.has(row.question_id)) {
          questions.set(row.question_id, []);
        }
        questions.get(row.question_id).push(row.option_id);
      }

      if (
        questions.size !== 5
        || [...questions.values()].some((options) => options.length !== 3)
      ) {
        return { error: "CONTENT_INVALID" };
      }

      const quizOrder = shuffle(
        [...questions.entries()].map(([questionId, optionIds]) => ({
          questionId,
          optionIds: shuffle(optionIds),
        })),
      );

      const createdResult = await client.query(`
        INSERT INTO lingua.attempts (
          user_id,
          lesson_id,
          quiz_order
        )
        VALUES ($1::uuid, $2::uuid, $3::jsonb)
        RETURNING id
      `, [userId, lessonId, JSON.stringify(quizOrder)]);

      return {
        attemptId: createdResult.rows[0].id,
        created: true,
        resumed: false,
      };
    });
  }

  async findOwnedAttempt(attemptId, userId) {
    const { rows } = await Database.query(`
      SELECT
        attempt.id,
        attempt.lesson_id,
        attempt.status,
        attempt.correct_count,
        attempt.question_count,
        attempt.started_at,
        attempt.completed_at,
        lesson.title AS lesson_title,
        lesson.topic AS lesson_topic,
        lesson.version AS lesson_version,
        language.id AS language_id,
        language.code AS language_code,
        language.name AS language_name,
        language.native_name AS language_native_name
      FROM lingua.attempts attempt
      JOIN lingua.lessons lesson ON lesson.id = attempt.lesson_id
      JOIN lingua.languages language ON language.id = lesson.language_id
      WHERE attempt.id = $1::uuid
        AND attempt.user_id = $2::uuid
      LIMIT 1
    `, [attemptId, userId]);

    return rows[0] ?? null;
  }

  async listOwnedAttemptQuestions(attemptId, userId) {
    const { rows } = await Database.query(`
      SELECT
        question_order.ordinality::integer AS question_position,
        question.id AS question_id,
        question.question_type,
        question.prompt,
        phrase.id AS phrase_id,
        phrase.target_text,
        option_order.ordinality::integer AS option_position,
        question_option.id AS option_id,
        question_option.option_text,
        answer.selected_option_id,
        answer.is_correct AS answer_is_correct,
        answer.answered_at,
        CASE WHEN answer.id IS NOT NULL THEN question.explanation END
          AS explanation,
        CASE WHEN answer.id IS NOT NULL THEN correct_option.id END
          AS correct_option_id
      FROM lingua.attempts attempt
      CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(attempt.quiz_order)
        WITH ORDINALITY AS question_order(value, ordinality)
      JOIN lingua.questions question
        ON question.id = (question_order.value->>'questionId')::uuid
      JOIN lingua.phrases phrase ON phrase.id = question.phrase_id
      CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(
        question_order.value->'optionIds'
      ) WITH ORDINALITY AS option_order(value, ordinality)
      JOIN lingua.question_options question_option
        ON question_option.id = option_order.value::uuid
        AND question_option.question_id = question.id
      LEFT JOIN lingua.attempt_answers answer
        ON answer.attempt_id = attempt.id
        AND answer.question_id = question.id
      LEFT JOIN lingua.question_options correct_option
        ON correct_option.question_id = question.id
        AND correct_option.is_correct IS TRUE
        AND answer.id IS NOT NULL
      WHERE attempt.id = $1::uuid
        AND attempt.user_id = $2::uuid
      ORDER BY question_order.ordinality, option_order.ordinality
    `, [attemptId, userId]);

    return rows;
  }

  async submitAnswer({
    attemptId,
    questionId,
    optionId,
    userId,
    mode,
  }) {
    return Database.transaction(async (client) => {
      const attemptResult = await client.query(`
        SELECT id, status, quiz_order
        FROM lingua.attempts
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        LIMIT 1
        FOR UPDATE
      `, [attemptId, userId]);
      const attempt = attemptResult.rows[0];

      if (!attempt) {
        return { error: "ATTEMPT_NOT_FOUND" };
      }

      const attemptQuestion = attempt.quiz_order.find(
        (question) => question.questionId === questionId,
      );
      if (!attemptQuestion) {
        return { error: "QUESTION_NOT_IN_ATTEMPT" };
      }
      if (!attemptQuestion.optionIds.includes(optionId)) {
        return { error: "INVALID_OPTION" };
      }

      const optionResult = await client.query(`
        SELECT
          question_option.id,
          question_option.is_correct,
          question.explanation,
          correct_option.id AS correct_option_id
        FROM lingua.question_options question_option
        JOIN lingua.questions question
          ON question.id = question_option.question_id
        JOIN lingua.question_options correct_option
          ON correct_option.question_id = question.id
          AND correct_option.is_correct IS TRUE
        WHERE question_option.id = $1::uuid
          AND question.id = $2::uuid
        LIMIT 1
      `, [optionId, questionId]);
      const option = optionResult.rows[0];

      if (!option) {
        return { error: "INVALID_OPTION" };
      }

      const answerResult = await client.query(`
        SELECT
          id,
          selected_option_id,
          is_correct,
          answered_at
        FROM lingua.attempt_answers
        WHERE attempt_id = $1::uuid
          AND question_id = $2::uuid
        LIMIT 1
        FOR UPDATE
      `, [attemptId, questionId]);
      const existingAnswer = answerResult.rows[0];

      if (mode === "PRACTICE") {
        if (!existingAnswer || existingAnswer.is_correct === true) {
          return { error: "PRACTICE_NOT_ALLOWED" };
        }

        return {
          created: false,
          idempotent: false,
          practice: true,
          persisted: false,
          answer: {
            question_id: questionId,
            selected_option_id: optionId,
            is_correct: option.is_correct,
            correct_option_id: option.correct_option_id,
            explanation: option.explanation,
            answered_at: null,
          },
        };
      }

      if (existingAnswer) {
        if (existingAnswer.selected_option_id !== optionId) {
          return { error: "ANSWER_ALREADY_SUBMITTED" };
        }

        return {
          created: false,
          idempotent: true,
          practice: false,
          persisted: true,
          answer: {
            question_id: questionId,
            selected_option_id: existingAnswer.selected_option_id,
            is_correct: existingAnswer.is_correct,
            correct_option_id: option.correct_option_id,
            explanation: option.explanation,
            answered_at: existingAnswer.answered_at,
          },
        };
      }

      if (attempt.status !== "IN_PROGRESS") {
        return { error: "ATTEMPT_ALREADY_COMPLETED" };
      }

      const createdResult = await client.query(`
        INSERT INTO lingua.attempt_answers (
          attempt_id,
          question_id,
          selected_option_id,
          is_correct
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::boolean)
        RETURNING id, selected_option_id, is_correct, answered_at
      `, [attemptId, questionId, optionId, option.is_correct]);
      const createdAnswer = createdResult.rows[0];

      return {
        created: true,
        idempotent: false,
        practice: false,
        persisted: true,
        answer: {
          question_id: questionId,
          selected_option_id: createdAnswer.selected_option_id,
          is_correct: createdAnswer.is_correct,
          correct_option_id: option.correct_option_id,
          explanation: option.explanation,
          answered_at: createdAnswer.answered_at,
        },
      };
    });
  }

  async finishAttempt({ attemptId, userId }) {
    return Database.transaction(async (client) => {
      const attemptResult = await client.query(`
        SELECT
          id,
          status,
          quiz_order,
          correct_count,
          question_count,
          completed_at
        FROM lingua.attempts
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        LIMIT 1
        FOR UPDATE
      `, [attemptId, userId]);
      const attempt = attemptResult.rows[0];

      if (!attempt) {
        return { error: "ATTEMPT_NOT_FOUND" };
      }

      if (attempt.status === "COMPLETED") {
        return {
          updated: false,
          correctCount: attempt.correct_count,
          questionCount: attempt.question_count,
          completedAt: attempt.completed_at,
        };
      }

      const expectedQuestionCount = attempt.quiz_order.length;
      const answerResult = await client.query(`
        SELECT
          COUNT(*)::integer AS answer_count,
          COUNT(*) FILTER (WHERE is_correct IS TRUE)::integer
            AS correct_count
        FROM lingua.attempt_answers
        WHERE attempt_id = $1::uuid
      `, [attemptId]);
      const answerSummary = answerResult.rows[0];

      if (
        expectedQuestionCount !== 5
        || answerSummary.answer_count !== expectedQuestionCount
      ) {
        return {
          error: "ATTEMPT_INCOMPLETE",
          answeredCount: answerSummary.answer_count,
          questionCount: expectedQuestionCount,
        };
      }

      const completedResult = await client.query(`
        UPDATE lingua.attempts
        SET
          status = 'COMPLETED',
          correct_count = $3::smallint,
          question_count = $4::smallint,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
          AND user_id = $2::uuid
        RETURNING correct_count, question_count, completed_at
      `, [
        attemptId,
        userId,
        answerSummary.correct_count,
        expectedQuestionCount,
      ]);

      return {
        updated: true,
        correctCount: completedResult.rows[0].correct_count,
        questionCount: completedResult.rows[0].question_count,
        completedAt: completedResult.rows[0].completed_at,
      };
    });
  }

  async getItineraryLanguageContext({ itineraryId, userId }) {
    const { rows } = await Database.query(`
      WITH accessible_itinerary AS (
        SELECT
          itinerary_record.id,
          NULLIF(BTRIM(itinerary_record.itinerary_json->>'city_id'), '')
            AS city_identifier
        FROM itinerary.itineraries itinerary_record
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.deleted_at IS NULL
          AND (${itineraryAccessSql})
        LIMIT 1
      )
      SELECT
        accessible_itinerary.id AS itinerary_id,
        country.id AS country_id,
        country.name AS country_name,
        country.code AS country_code,
        COALESCE(selected_language.id, default_language.id)
          AS selected_language_id,
        COALESCE(selected_language.code, default_language.code)
          AS selected_language_code,
        COALESCE(selected_language.name, default_language.name)
          AS selected_language_name,
        COALESCE(selected_language.native_name, default_language.native_name)
          AS selected_language_native_name,
        CASE
          WHEN selected_language.id IS NOT NULL THEN 'USER'
          WHEN default_language.id IS NOT NULL THEN 'ITINERARY'
          ELSE 'NONE'
        END AS selection_source
      FROM accessible_itinerary
      LEFT JOIN LATERAL (
        SELECT city.country_id
        FROM poi.cities city
        WHERE city.is_active IS TRUE
          AND (
            city.id::text = LOWER(accessible_itinerary.city_identifier)
            OR (
              city.provider = 'GOOGLE_PLACES'
              AND city.provider_id = accessible_itinerary.city_identifier
            )
          )
        ORDER BY city.id
        LIMIT 1
      ) destination ON TRUE
      LEFT JOIN poi.countries country
        ON country.id = destination.country_id
        AND country.is_active IS TRUE
      LEFT JOIN lingua.user_itinerary_languages user_selection
        ON user_selection.user_id = $2::uuid
        AND user_selection.itinerary_id = accessible_itinerary.id
      LEFT JOIN lingua.languages selected_language
        ON selected_language.id = user_selection.language_id
        AND selected_language.status = 'PUBLISHED'
      LEFT JOIN lingua.country_languages country_language
        ON country_language.country_id = country.id
        AND country_language.is_default IS TRUE
      LEFT JOIN lingua.languages default_language
        ON default_language.id = country_language.language_id
        AND default_language.status = 'PUBLISHED'
    `, [itineraryId, userId]);

    return rows[0] ?? null;
  }

  async setItineraryLanguage({ itineraryId, userId, languageId }) {
    const { rows } = await Database.query(`
      INSERT INTO lingua.user_itinerary_languages (
        user_id,
        itinerary_id,
        language_id
      )
      SELECT $2::uuid, itinerary_record.id, $3::uuid
      FROM itinerary.itineraries itinerary_record
      JOIN lingua.languages language
        ON language.id = $3::uuid
        AND language.status = 'PUBLISHED'
      WHERE itinerary_record.id = $1::uuid
        AND itinerary_record.deleted_at IS NULL
        AND (${itineraryAccessSql})
      ON CONFLICT (user_id, itinerary_id)
      DO UPDATE SET
        language_id = EXCLUDED.language_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING language_id
    `, [itineraryId, userId, languageId]);

    return rows[0] ?? null;
  }

  async resetItineraryLanguage({ itineraryId, userId }) {
    const { rowCount } = await Database.query(`
      DELETE FROM lingua.user_itinerary_languages selection
      USING itinerary.itineraries itinerary_record
      WHERE selection.user_id = $2::uuid
        AND selection.itinerary_id = $1::uuid
        AND itinerary_record.id = selection.itinerary_id
        AND itinerary_record.deleted_at IS NULL
        AND (${itineraryAccessSql})
    `, [itineraryId, userId]);

    return rowCount > 0;
  }
}

export default new LinguaRepository();
