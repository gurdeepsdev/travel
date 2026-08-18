BEGIN;

-- =====================================================
-- City represented by each user collection
-- =====================================================

ALTER TABLE users.collection
  ADD COLUMN city_id UUID;

ALTER TABLE users.collection
  ADD CONSTRAINT
    fk_users_collection_city
  FOREIGN KEY (
    city_id
  )
  REFERENCES poi.cities(id)
  ON DELETE RESTRICT;

-- The tables are currently empty, so city_id can safely
-- become mandatory without a legacy-data backfill.
ALTER TABLE users.collection
  ALTER COLUMN city_id
    SET NOT NULL;

-- Collection names are presentation data, not identity.
-- Two cities may legitimately share the same name.
DROP INDEX IF EXISTS
  users.uq_users_collection_name_per_user;

CREATE UNIQUE INDEX
  uq_users_collection_user_city
ON users.collection (
  user_id,
  city_id
);

CREATE INDEX
  idx_users_collection_city
ON users.collection (
  city_id
);

-- The previous schema allowed only one preferred city.
DROP INDEX IF EXISTS
  users.uq_users_collection_one_preference;

ALTER TABLE users.collection
  ADD CONSTRAINT
    chk_users_collection_preference_verified
  CHECK (
    is_preference IS FALSE
    OR verification_status IS TRUE
  );

-- =====================================================
-- Historical gallery-photo verification evidence
-- =====================================================

ALTER TABLE users.visited_places
  ADD COLUMN claimed_visited_at
    TIMESTAMPTZ,

  ADD COLUMN evidence_captured_at
    TIMESTAMPTZ,

  ADD COLUMN evidence_latitude
    DOUBLE PRECISION,

  ADD COLUMN evidence_longitude
    DOUBLE PRECISION,

  ADD COLUMN evidence_sha256
    VARCHAR(64),

  ADD COLUMN evidence_perceptual_hash
    VARCHAR(128),

  ADD COLUMN verification_details
    JSONB NOT NULL
      DEFAULT '{}'::jsonb;

ALTER TABLE users.visited_places
  ADD CONSTRAINT
    chk_visited_places_evidence_latitude
  CHECK (
    evidence_latitude IS NULL
    OR evidence_latitude BETWEEN
      -90 AND 90
  ),

  ADD CONSTRAINT
    chk_visited_places_evidence_longitude
  CHECK (
    evidence_longitude IS NULL
    OR evidence_longitude BETWEEN
      -180 AND 180
  ),

  ADD CONSTRAINT
    chk_visited_places_evidence_sha256
  CHECK (
    evidence_sha256 IS NULL
    OR evidence_sha256 ~
      '^[0-9a-f]{64}$'
  ),

  ADD CONSTRAINT
    chk_visited_places_verification_details_object
  CHECK (
    jsonb_typeof(
      verification_details
    ) = 'object'
  );

-- One exact image cannot verify multiple visits or users.
CREATE UNIQUE INDEX
  uq_visited_places_evidence_sha256
ON users.visited_places (
  evidence_sha256
)
WHERE evidence_sha256 IS NOT NULL;

CREATE INDEX
  idx_visited_places_evidence_perceptual_hash
ON users.visited_places (
  evidence_perceptual_hash
)
WHERE evidence_perceptual_hash IS NOT NULL;

-- =====================================================
-- Maximum five preferred verified cities per user
-- =====================================================

CREATE OR REPLACE FUNCTION
  users.enforce_collection_preference_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  preferred_count INTEGER;
BEGIN
  IF NEW.is_preference IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS NOT TRUE THEN
    RAISE EXCEPTION
      'Only a verified city can be selected for profile display.'
      USING ERRCODE = '23514';
  END IF;

  -- Serialize preference changes for this user so two
  -- concurrent requests cannot both become the sixth.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'users.collection.preference:' ||
      NEW.user_id::text,
      0
    )
  );

  SELECT
    COUNT(*)::integer
  INTO preferred_count
  FROM users.collection
    AS existing_collection
  WHERE existing_collection.user_id =
      NEW.user_id
    AND existing_collection.is_preference
      IS TRUE
    AND existing_collection.id <>
      NEW.id;

  IF preferred_count >= 5 THEN
    RAISE EXCEPTION
      'A maximum of five verified cities can be selected for profile display.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
  trg_users_collection_preference_limit
ON users.collection;

CREATE TRIGGER
  trg_users_collection_preference_limit
BEFORE INSERT OR UPDATE
ON users.collection
FOR EACH ROW
EXECUTE FUNCTION
  users.enforce_collection_preference_limit();

COMMENT ON COLUMN
  users.collection.city_id
IS
  'Canonical city verified for this user collection.';

COMMENT ON COLUMN
  users.visited_places.claimed_visited_at
IS
  'Optional historical visit time claimed by the user.';

COMMENT ON COLUMN
  users.visited_places.evidence_captured_at
IS
  'Capture time extracted from image evidence when available.';

COMMENT ON COLUMN
  users.visited_places.evidence_latitude
IS
  'Latitude extracted from image evidence when available.';

COMMENT ON COLUMN
  users.visited_places.evidence_longitude
IS
  'Longitude extracted from image evidence when available.';

COMMENT ON COLUMN
  users.visited_places.evidence_sha256
IS
  'Lowercase SHA-256 digest used for exact duplicate detection.';

COMMENT ON COLUMN
  users.visited_places.evidence_perceptual_hash
IS
  'Perceptual image hash used for near-duplicate detection.';

COMMENT ON COLUMN
  users.visited_places.verification_details
IS
  'Internal evidence and verification result details.';

COMMIT;

