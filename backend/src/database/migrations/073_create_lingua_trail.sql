BEGIN;

CREATE SCHEMA IF NOT EXISTS lingua;

CREATE TABLE lingua.languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100) NOT NULL,
  display_order SMALLINT NOT NULL CHECK (display_order > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (code = LOWER(code)),
  CHECK (LENGTH(BTRIM(name)) > 0),
  CHECK (LENGTH(BTRIM(native_name)) > 0)
);

CREATE UNIQUE INDEX uq_lingua_languages_display_order
  ON lingua.languages(display_order);

CREATE TABLE lingua.country_languages (
  country_id UUID NOT NULL
    REFERENCES poi.countries(id) ON DELETE CASCADE,
  language_id UUID NOT NULL
    REFERENCES lingua.languages(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (country_id, language_id)
);

CREATE UNIQUE INDEX uq_lingua_country_default_language
  ON lingua.country_languages(country_id)
  WHERE is_default IS TRUE;

CREATE INDEX idx_lingua_country_languages_language
  ON lingua.country_languages(language_id, country_id);

CREATE TABLE lingua.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL
    REFERENCES lingua.languages(id) ON DELETE RESTRICT,
  stable_key VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  title VARCHAR(150) NOT NULL,
  topic VARCHAR(30) NOT NULL
    CHECK (topic IN ('GREETINGS', 'TRANSPORT', 'HOTEL', 'FOOD', 'HELP')),
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (language_id, stable_key, version),
  UNIQUE (language_id, display_order, version),
  CHECK (LENGTH(BTRIM(stable_key)) > 0),
  CHECK (LENGTH(BTRIM(title)) > 0),
  CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL)
    OR status <> 'PUBLISHED'
  )
);

CREATE INDEX idx_lingua_lessons_published
  ON lingua.lessons(language_id, display_order, version DESC)
  WHERE status = 'PUBLISHED';

CREATE TABLE lingua.phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL
    REFERENCES lingua.lessons(id) ON DELETE CASCADE,
  stable_key VARCHAR(100) NOT NULL,
  target_text TEXT NOT NULL,
  english_meaning TEXT NOT NULL,
  romanization TEXT,
  pronunciation_hint TEXT,
  regional_variant VARCHAR(100),
  audio_asset_id UUID
    REFERENCES media.assets(id) ON DELETE SET NULL,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (lesson_id, stable_key),
  UNIQUE (lesson_id, display_order),
  CHECK (LENGTH(BTRIM(stable_key)) > 0),
  CHECK (LENGTH(BTRIM(target_text)) > 0),
  CHECK (LENGTH(BTRIM(english_meaning)) > 0)
);

CREATE INDEX idx_lingua_phrases_audio_asset
  ON lingua.phrases(audio_asset_id)
  WHERE audio_asset_id IS NOT NULL;

CREATE TABLE lingua.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID NOT NULL UNIQUE
    REFERENCES lingua.phrases(id) ON DELETE CASCADE,
  question_type VARCHAR(40) NOT NULL
    CHECK (question_type IN ('MEANING_RECOGNITION', 'SITUATION_TO_PHRASE')),
  prompt TEXT NOT NULL,
  explanation TEXT NOT NULL,
  explanation_language VARCHAR(10) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (LENGTH(BTRIM(prompt)) > 0),
  CHECK (LENGTH(BTRIM(explanation)) > 0),
  CHECK (explanation_language = LOWER(explanation_language))
);

CREATE TABLE lingua.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL
    REFERENCES lingua.questions(id) ON DELETE CASCADE,
  stable_key VARCHAR(50) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (question_id, stable_key),
  UNIQUE (question_id, display_order),
  CHECK (LENGTH(BTRIM(stable_key)) > 0),
  CHECK (LENGTH(BTRIM(option_text)) > 0)
);

CREATE UNIQUE INDEX uq_lingua_question_correct_option
  ON lingua.question_options(question_id)
  WHERE is_correct IS TRUE;

CREATE TABLE lingua.user_itinerary_languages (
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  itinerary_id UUID NOT NULL
    REFERENCES itinerary.itineraries(id) ON DELETE CASCADE,
  language_id UUID NOT NULL
    REFERENCES lingua.languages(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, itinerary_id)
);

CREATE INDEX idx_lingua_user_itinerary_language
  ON lingua.user_itinerary_languages(language_id, user_id);

CREATE TABLE lingua.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL
    REFERENCES lingua.lessons(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  quiz_order JSONB NOT NULL,
  correct_count SMALLINT,
  question_count SMALLINT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (JSONB_TYPEOF(quiz_order) = 'array'),
  CHECK (correct_count IS NULL OR correct_count >= 0),
  CHECK (question_count IS NULL OR question_count > 0),
  CHECK (
    (status = 'IN_PROGRESS'
      AND correct_count IS NULL
      AND question_count IS NULL
      AND completed_at IS NULL)
    OR
    (status = 'COMPLETED'
      AND correct_count IS NOT NULL
      AND question_count IS NOT NULL
      AND correct_count <= question_count
      AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_lingua_active_attempt
  ON lingua.attempts(user_id, lesson_id)
  WHERE status = 'IN_PROGRESS';

CREATE INDEX idx_lingua_attempts_user_progress
  ON lingua.attempts(user_id, lesson_id, status, completed_at DESC);

CREATE TABLE lingua.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL
    REFERENCES lingua.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL
    REFERENCES lingua.questions(id) ON DELETE RESTRICT,
  selected_option_id UUID NOT NULL
    REFERENCES lingua.question_options(id) ON DELETE RESTRICT,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_lingua_attempt_answers_attempt
  ON lingua.attempt_answers(attempt_id, answered_at, id);

CREATE OR REPLACE FUNCTION lingua.reject_published_content_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  lesson_status VARCHAR(20);
BEGIN
  IF TG_TABLE_NAME = 'lessons' THEN
    lesson_status := OLD.status;
  ELSIF TG_TABLE_NAME = 'phrases' THEN
    SELECT status INTO lesson_status
    FROM lingua.lessons
    WHERE id = OLD.lesson_id;
  ELSIF TG_TABLE_NAME = 'questions' THEN
    SELECT lesson.status INTO lesson_status
    FROM lingua.phrases phrase
    JOIN lingua.lessons lesson ON lesson.id = phrase.lesson_id
    WHERE phrase.id = OLD.phrase_id;
  ELSE
    SELECT lesson.status INTO lesson_status
    FROM lingua.questions question
    JOIN lingua.phrases phrase ON phrase.id = question.phrase_id
    JOIN lingua.lessons lesson ON lesson.id = phrase.lesson_id
    WHERE question.id = OLD.question_id;
  END IF;

  IF lesson_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published LinguaTrail content is immutable.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_lingua_lessons_immutable
BEFORE UPDATE OR DELETE ON lingua.lessons
FOR EACH ROW
WHEN (OLD.status = 'PUBLISHED')
EXECUTE FUNCTION lingua.reject_published_content_mutation();

CREATE TRIGGER trg_lingua_phrases_immutable
BEFORE UPDATE OR DELETE ON lingua.phrases
FOR EACH ROW EXECUTE FUNCTION lingua.reject_published_content_mutation();

CREATE TRIGGER trg_lingua_questions_immutable
BEFORE UPDATE OR DELETE ON lingua.questions
FOR EACH ROW EXECUTE FUNCTION lingua.reject_published_content_mutation();

CREATE TRIGGER trg_lingua_question_options_immutable
BEFORE UPDATE OR DELETE ON lingua.question_options
FOR EACH ROW EXECUTE FUNCTION lingua.reject_published_content_mutation();

CREATE OR REPLACE FUNCTION lingua.publish_lesson(target_lesson_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  target_language_code VARCHAR(10);
  target_status VARCHAR(20);
BEGIN
  SELECT language.code, lesson.status
  INTO target_language_code, target_status
  FROM lingua.lessons lesson
  JOIN lingua.languages language ON language.id = lesson.language_id
  WHERE lesson.id = target_lesson_id
  FOR UPDATE OF lesson;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LinguaTrail lesson not found.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF target_status = 'PUBLISHED' THEN
    RETURN;
  END IF;

  IF target_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft LinguaTrail lessons can be published.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (SELECT COUNT(*) FROM lingua.phrases WHERE lesson_id = target_lesson_id) <> 5 THEN
    RAISE EXCEPTION 'A published LinguaTrail lesson requires exactly five phrases.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lingua.phrases phrase
    LEFT JOIN lingua.questions question ON question.phrase_id = phrase.id
    LEFT JOIN lingua.question_options option ON option.question_id = question.id
    WHERE phrase.lesson_id = target_lesson_id
    GROUP BY phrase.id, question.id
    HAVING question.id IS NULL
      OR COUNT(option.id) <> 3
      OR COUNT(option.id) FILTER (WHERE option.is_correct) <> 1
  ) THEN
    RAISE EXCEPTION 'Each phrase requires one question with exactly three options and one correct option.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF target_language_code = 'en' AND EXISTS (
    SELECT 1
    FROM lingua.phrases phrase
    JOIN lingua.questions question ON question.phrase_id = phrase.id
    WHERE phrase.lesson_id = target_lesson_id
      AND question.question_type <> 'SITUATION_TO_PHRASE'
  ) THEN
    RAISE EXCEPTION 'English lessons require situation-to-phrase questions.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lingua.phrases phrase
    JOIN media.assets asset ON asset.id = phrase.audio_asset_id
    WHERE phrase.lesson_id = target_lesson_id
      AND phrase.audio_asset_id IS NOT NULL
      AND (
        asset.deleted_at IS NOT NULL
        OR asset.is_public IS NOT TRUE
        OR asset.mime_type NOT LIKE 'audio/%'
      )
  ) THEN
    RAISE EXCEPTION 'Published lesson audio must be an active public audio asset.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE lingua.lessons
  SET status = 'PUBLISHED',
      published_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = target_lesson_id;
END;
$$;

CREATE TRIGGER trg_lingua_languages_updated_at
BEFORE UPDATE ON lingua.languages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_lessons_updated_at
BEFORE UPDATE ON lingua.lessons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_phrases_updated_at
BEFORE UPDATE ON lingua.phrases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_questions_updated_at
BEFORE UPDATE ON lingua.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_question_options_updated_at
BEFORE UPDATE ON lingua.question_options
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_user_itinerary_languages_updated_at
BEFORE UPDATE ON lingua.user_itinerary_languages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lingua_attempts_updated_at
BEFORE UPDATE ON lingua.attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO lingua.languages (
  code,
  name,
  native_name,
  display_order,
  status
)
VALUES
  ('fr', 'French', 'Français', 1, 'DRAFT'),
  ('es', 'Spanish', 'Español', 2, 'DRAFT'),
  ('en', 'English', 'English', 3, 'DRAFT'),
  ('it', 'Italian', 'Italiano', 4, 'DRAFT'),
  ('tr', 'Turkish', 'Türkçe', 5, 'DRAFT'),
  ('de', 'German', 'Deutsch', 6, 'DRAFT'),
  ('ja', 'Japanese', '日本語', 7, 'DRAFT'),
  ('th', 'Thai', 'ไทย', 8, 'DRAFT'),
  ('pt', 'Portuguese', 'Português', 9, 'DRAFT'),
  ('ar', 'Arabic', 'العربية', 10, 'DRAFT')
ON CONFLICT (code) DO NOTHING;

COMMIT;
