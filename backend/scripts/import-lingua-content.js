import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Database from "../src/database/database-manager.js";
import { linguaContentSchema } from "../src/modules/lingua/lingua-content.schema.js";

function parseArguments(argv) {
  const fileIndex = argv.indexOf("--file");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : null;
  const apply = argv.includes("--apply");
  const publish = argv.includes("--publish");

  if (!file) {
    throw new Error("Usage: node scripts/import-lingua-content.js --file <json> [--apply] [--publish]");
  }
  if (publish && !apply) {
    throw new Error("--publish requires --apply.");
  }

  return { file: path.resolve(file), apply, publish };
}

async function upsertLanguage(client, language) {
  const { rows } = await client.query(`
    INSERT INTO lingua.languages (
      code, name, native_name, display_order, status
    )
    VALUES ($1, $2, $3, $4, 'DRAFT')
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      native_name = EXCLUDED.native_name,
      display_order = EXCLUDED.display_order,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, status
  `, [language.code, language.name, language.nativeName, language.displayOrder]);

  return rows[0];
}

async function replaceCountryMappings(
  client,
  languageId,
  countryCodes,
  requireAllCountries,
) {
  if (countryCodes.length === 0) return [];

  const { rows: countries } = await client.query(`
    SELECT id, UPPER(code) AS code
    FROM poi.countries
    WHERE is_active IS TRUE
      AND UPPER(code) = ANY($1::text[])
  `, [countryCodes]);
  const foundCodes = new Set(countries.map((country) => country.code));
  const missingCodes = countryCodes.filter((code) => !foundCodes.has(code));

  if (requireAllCountries && missingCodes.length > 0) {
    throw new Error(`Unknown active country codes: ${missingCodes.join(", ")}`);
  }

  const countryIds = countries.map((country) => country.id);
  if (countryIds.length === 0) return missingCodes;

  await client.query(`
    UPDATE lingua.country_languages
    SET is_default = FALSE
    WHERE country_id = ANY($1::uuid[])
      AND is_default IS TRUE
  `, [countryIds]);

  await client.query(`
    INSERT INTO lingua.country_languages (
      country_id, language_id, is_default
    )
    SELECT mapped_country.country_id, $2::uuid, TRUE
    FROM UNNEST($1::uuid[]) AS mapped_country(country_id)
    ON CONFLICT (country_id, language_id)
    DO UPDATE SET is_default = TRUE
  `, [countryIds, languageId]);

  return missingCodes;
}

async function replaceDraftLesson(client, languageId, lesson) {
  const existingResult = await client.query(`
    SELECT id, status
    FROM lingua.lessons
    WHERE language_id = $1::uuid
      AND stable_key = $2
      AND version = $3
    LIMIT 1
    FOR UPDATE
  `, [languageId, lesson.stableKey, lesson.version]);
  const existing = existingResult.rows[0];

  if (existing && existing.status !== "DRAFT") {
    throw new Error(
      `Lesson ${lesson.stableKey} v${lesson.version} is ${existing.status}; create a new version.`,
    );
  }

  let lessonId = existing?.id;
  if (lessonId) {
    await client.query(`
      UPDATE lingua.lessons
      SET title = $2, topic = $3, display_order = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid
    `, [lessonId, lesson.title, lesson.topic, lesson.displayOrder]);
    await client.query(
      "DELETE FROM lingua.phrases WHERE lesson_id = $1::uuid",
      [lessonId],
    );
  } else {
    const createdResult = await client.query(`
      INSERT INTO lingua.lessons (
        language_id, stable_key, version, title, topic, display_order
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      languageId,
      lesson.stableKey,
      lesson.version,
      lesson.title,
      lesson.topic,
      lesson.displayOrder,
    ]);
    lessonId = createdResult.rows[0].id;
  }

  for (const phrase of lesson.phrases) {
    const phraseResult = await client.query(`
      INSERT INTO lingua.phrases (
        lesson_id, stable_key, target_text, english_meaning,
        romanization, pronunciation_hint, regional_variant,
        audio_asset_id, display_order
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, $9)
      RETURNING id
    `, [
      lessonId,
      phrase.stableKey,
      phrase.targetText,
      phrase.englishMeaning,
      phrase.romanization ?? null,
      phrase.pronunciationHint ?? null,
      phrase.regionalVariant ?? null,
      phrase.audioAssetId ?? null,
      phrase.displayOrder,
    ]);
    const phraseId = phraseResult.rows[0].id;
    const question = phrase.question;
    const questionResult = await client.query(`
      INSERT INTO lingua.questions (
        phrase_id, question_type, prompt, explanation, explanation_language
      )
      VALUES ($1::uuid, $2, $3, $4, $5)
      RETURNING id
    `, [
      phraseId,
      question.type,
      question.prompt,
      question.explanation,
      question.explanationLanguage,
    ]);
    const questionId = questionResult.rows[0].id;

    for (const option of question.options) {
      await client.query(`
        INSERT INTO lingua.question_options (
          question_id, stable_key, option_text, is_correct, display_order
        )
        VALUES ($1::uuid, $2, $3, $4, $5)
      `, [
        questionId,
        option.stableKey,
        option.text,
        option.correct,
        option.displayOrder,
      ]);
    }
  }

  return lessonId;
}

async function importContent(content, publish) {
  return Database.transaction(async (client) => {
    const language = await upsertLanguage(client, content.language);
    const missingCountryCodes = await replaceCountryMappings(
      client,
      language.id,
      content.language.defaultCountryCodes,
      publish,
    );

    const lessonIds = [];
    for (const lesson of content.lessons) {
      lessonIds.push(await replaceDraftLesson(client, language.id, lesson));
    }

    if (publish) {
      for (const lessonId of lessonIds) {
        await client.query("SELECT lingua.publish_lesson($1::uuid)", [lessonId]);
      }
      await client.query(`
        UPDATE lingua.languages
        SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
      `, [language.id]);
    }

    return { languageId: language.id, lessonIds, missingCountryCodes };
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = JSON.parse(await fs.readFile(options.file, "utf8"));
  const content = linguaContentSchema.parse(source);
  const summary = {
    valid: true,
    mode: options.apply ? (options.publish ? "PUBLISH" : "APPLY_DRAFT") : "DRY_RUN",
    language: content.language.code,
    lessons: content.lessons.length,
    phrases: content.lessons.reduce((total, lesson) => total + lesson.phrases.length, 0),
    questions: content.lessons.reduce((total, lesson) => total + lesson.phrases.length, 0),
  };

  if (!options.apply) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  const result = await importContent(content, options.publish);
  const warnings = result.missingCountryCodes.length > 0
    ? [`Skipped unavailable country mappings: ${result.missingCountryCodes.join(", ")}`]
    : [];
  const importResult = { ...result };
  delete importResult.missingCountryCodes;
  process.stdout.write(`${JSON.stringify({
    ...summary,
    ...importResult,
    warnings,
  }, null, 2)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  },
);
