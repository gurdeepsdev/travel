BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. USERS.PROFILES
-- =========================================================

-- Rename username -> user_name when the old column exists.


ALTER TABLE users.profiles
ADD COLUMN IF NOT EXISTS username varchar(100),
  ADD COLUMN IF NOT EXISTS display_name varchar(100),
  ADD COLUMN IF NOT EXISTS bio varchar(250),
  ADD COLUMN IF NOT EXISTS profile_photo_asset_id uuid,
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_profiles_user_id
  ON users.profiles (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_profiles_username
ON users.profiles (lower(username))
WHERE deleted_at IS NULL
  AND username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_profiles_country_id
  ON users.profiles (country_id);

CREATE INDEX IF NOT EXISTS idx_users_profiles_city_id
  ON users.profiles (city_id);

CREATE INDEX IF NOT EXISTS idx_users_profiles_profile_photo
  ON users.profiles (profile_photo_asset_id);

CREATE INDEX IF NOT EXISTS idx_users_profiles_active
  ON users.profiles (user_id)
  WHERE deleted_at IS NULL;

-- =========================================================
-- 2. USERS.COLLECTION
-- =========================================================

CREATE TABLE IF NOT EXISTS users.collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  collections_name varchar(50) NOT NULL,

  icon_asset_id uuid,
  verification_asset_id uuid,

  verification_status boolean NOT NULL DEFAULT false,

  visited_at timestamptz,

  is_preference boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_users_collection_name_not_empty
    CHECK (length(trim(collections_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_users_collection_user_id
  ON users.collection (user_id);

CREATE INDEX IF NOT EXISTS idx_users_collection_user_preference
  ON users.collection (user_id, is_preference);

CREATE INDEX IF NOT EXISTS idx_users_collection_visited_at
  ON users.collection (visited_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_collection_name_per_user
  ON users.collection (
    user_id,
    lower(collections_name)
  );

-- One user should only have one preferred collection.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_collection_one_preference
  ON users.collection (user_id)
  WHERE is_preference IS TRUE;

-- =========================================================
-- 3. USERS.VISITED_PLACES
-- =========================================================

ALTER TABLE users.visited_places
  ADD COLUMN IF NOT EXISTS collections_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_visited_places_user_id
  ON users.visited_places (user_id);

CREATE INDEX IF NOT EXISTS idx_users_visited_places_place_id
  ON users.visited_places (place_id);

CREATE INDEX IF NOT EXISTS idx_users_visited_places_collection_id
  ON users.visited_places (collections_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_visited_places_user_place_collection
  ON users.visited_places (
    user_id,
    place_id,
    collections_id
  )
  WHERE collections_id IS NOT NULL;

-- =========================================================
-- 4. CREATE DEFAULT COLLECTIONS FOR EXISTING USERS
-- =========================================================

INSERT INTO users.collection (
  user_id,
  collections_name,
  verification_status,
  is_preference,
  created_at,
  updated_at
)
SELECT DISTINCT
  visited_place.user_id,
  'Visited Places',
  false,
  true,
  now(),
  now()
FROM users.visited_places AS visited_place
WHERE visited_place.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users.collection AS existing_collection
    WHERE existing_collection.user_id = visited_place.user_id
      AND existing_collection.is_preference IS TRUE
  );

UPDATE users.visited_places AS visited_place
SET collections_id = preferred_collection.id
FROM users.collection AS preferred_collection
WHERE preferred_collection.user_id = visited_place.user_id
  AND preferred_collection.is_preference IS TRUE
  AND visited_place.collections_id IS NULL;

-- Only enforce NOT NULL after old rows are backfilled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM users.visited_places
    WHERE collections_id IS NULL
  )
  THEN
    ALTER TABLE users.visited_places
      ALTER COLUMN collections_id SET NOT NULL;
  END IF;
END
$$;

-- =========================================================
-- 5. USERS.SAVED_ITEMS
-- =========================================================

ALTER TABLE users.saved_items
  ADD COLUMN IF NOT EXISTS item_type varchar(50),
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_saved_items_user_id
  ON users.saved_items (user_id);

CREATE INDEX IF NOT EXISTS idx_users_saved_items_active
  ON users.saved_items (user_id, created_at DESC)
  WHERE is_active IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_saved_items_active_item
  ON users.saved_items (
    user_id,
    item_type,
    item_id
  )
  WHERE is_active IS TRUE;

-- =========================================================
-- 6. USERS.BLOCKED_USERS
-- =========================================================

ALTER TABLE users.blocked_users
  ADD COLUMN IF NOT EXISTS reason varchar(250),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_blocked_users_user_id
  ON users.blocked_users (user_id);

CREATE INDEX IF NOT EXISTS idx_users_blocked_users_blocked_user_id
  ON users.blocked_users (blocked_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_blocked_users_pair
  ON users.blocked_users (
    user_id,
    blocked_user_id
  );

-- Prevent users from blocking themselves.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_users_blocked_users_not_self'
      AND conrelid = 'users.blocked_users'::regclass
  )
  THEN
    ALTER TABLE users.blocked_users
      ADD CONSTRAINT chk_users_blocked_users_not_self
      CHECK (user_id <> blocked_user_id);
  END IF;
END
$$;

-- =========================================================
-- 7. USERS.USER_SETTINGS
-- =========================================================

ALTER TABLE users.user_settings
  ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_user_settings_user_id
  ON users.user_settings (user_id);

-- =========================================================
-- 8. USERS.USERS_REPORTS
-- =========================================================

CREATE TABLE IF NOT EXISTS users.users_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  item_type varchar(50) NOT NULL,
  item_id uuid NOT NULL,

  status varchar(50) NOT NULL DEFAULT 'PENDING',

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_users_reports_item_type_not_empty
    CHECK (length(trim(item_type)) > 0),

  CONSTRAINT chk_users_reports_status
    CHECK (
      status IN (
        'PENDING',
        'UNDER_REVIEW',
        'RESOLVED',
        'REJECTED'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_users_reports_user_id
  ON users.users_reports (user_id);

CREATE INDEX IF NOT EXISTS idx_users_reports_item
  ON users.users_reports (item_type, item_id);

CREATE INDEX IF NOT EXISTS idx_users_reports_status
  ON users.users_reports (status, created_at DESC);

-- Prevent duplicate active reports by the same user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_reports_pending_item
  ON users.users_reports (
    user_id,
    item_type,
    item_id
  )
  WHERE status IN ('PENDING', 'UNDER_REVIEW');

-- =========================================================
-- 9. FOREIGN KEYS
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_profiles_user'
      AND conrelid = 'users.profiles'::regclass
  )
  THEN
    ALTER TABLE users.profiles
      ADD CONSTRAINT fk_users_profiles_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_profiles_profile_photo'
      AND conrelid = 'users.profiles'::regclass
  )
  THEN
    ALTER TABLE users.profiles
      ADD CONSTRAINT fk_users_profiles_profile_photo
      FOREIGN KEY (profile_photo_asset_id)
      REFERENCES media.assets(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_profiles_country'
      AND conrelid = 'users.profiles'::regclass
  )
  THEN
    ALTER TABLE users.profiles
      ADD CONSTRAINT fk_users_profiles_country
      FOREIGN KEY (country_id)
      REFERENCES poi.countries(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_profiles_city'
      AND conrelid = 'users.profiles'::regclass
  )
  THEN
    ALTER TABLE users.profiles
      ADD CONSTRAINT fk_users_profiles_city
      FOREIGN KEY (city_id)
      REFERENCES poi.cities(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_collection_user'
      AND conrelid = 'users.collection'::regclass
  )
  THEN
    ALTER TABLE users.collection
      ADD CONSTRAINT fk_users_collection_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_collection_icon_asset'
      AND conrelid = 'users.collection'::regclass
  )
  THEN
    ALTER TABLE users.collection
      ADD CONSTRAINT fk_users_collection_icon_asset
      FOREIGN KEY (icon_asset_id)
      REFERENCES media.assets(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_collection_verification_asset'
      AND conrelid = 'users.collection'::regclass
  )
  THEN
    ALTER TABLE users.collection
      ADD CONSTRAINT fk_users_collection_verification_asset
      FOREIGN KEY (verification_asset_id)
      REFERENCES media.assets(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_visited_places_user'
      AND conrelid = 'users.visited_places'::regclass
  )
  THEN
    ALTER TABLE users.visited_places
      ADD CONSTRAINT fk_users_visited_places_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_visited_places_place'
      AND conrelid = 'users.visited_places'::regclass
  )
  THEN
    ALTER TABLE users.visited_places
      ADD CONSTRAINT fk_users_visited_places_place
      FOREIGN KEY (place_id)
      REFERENCES poi.places(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_visited_places_collection'
      AND conrelid = 'users.visited_places'::regclass
  )
  THEN
    ALTER TABLE users.visited_places
      ADD CONSTRAINT fk_users_visited_places_collection
      FOREIGN KEY (collections_id)
      REFERENCES users.collection(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_saved_items_user'
      AND conrelid = 'users.saved_items'::regclass
  )
  THEN
    ALTER TABLE users.saved_items
      ADD CONSTRAINT fk_users_saved_items_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_blocked_users_user'
      AND conrelid = 'users.blocked_users'::regclass
  )
  THEN
    ALTER TABLE users.blocked_users
      ADD CONSTRAINT fk_users_blocked_users_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_blocked_users_blocked_user'
      AND conrelid = 'users.blocked_users'::regclass
  )
  THEN
    ALTER TABLE users.blocked_users
      ADD CONSTRAINT fk_users_blocked_users_blocked_user
      FOREIGN KEY (blocked_user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_user_settings_user'
      AND conrelid = 'users.user_settings'::regclass
  )
  THEN
    ALTER TABLE users.user_settings
      ADD CONSTRAINT fk_users_user_settings_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_reports_user'
      AND conrelid = 'users.users_reports'::regclass
  )
  THEN
    ALTER TABLE users.users_reports
      ADD CONSTRAINT fk_users_reports_user
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- =========================================================
-- 10. UPDATED_AT TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION users.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_profiles_updated_at
  ON users.profiles;

CREATE TRIGGER trg_users_profiles_updated_at
BEFORE UPDATE ON users.profiles
FOR EACH ROW
EXECUTE FUNCTION users.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_collection_updated_at
  ON users.collection;

CREATE TRIGGER trg_users_collection_updated_at
BEFORE UPDATE ON users.collection
FOR EACH ROW
EXECUTE FUNCTION users.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_user_settings_updated_at
  ON users.user_settings;

CREATE TRIGGER trg_users_user_settings_updated_at
BEFORE UPDATE ON users.user_settings
FOR EACH ROW
EXECUTE FUNCTION users.set_updated_at();

COMMIT;