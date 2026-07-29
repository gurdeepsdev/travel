BEGIN;

-- =====================================================
-- Upgrade users.profiles
-- =====================================================

-- -----------------------------------------------------
-- Remove old column
-- -----------------------------------------------------

ALTER TABLE users.profiles
DROP COLUMN avatar_url;

-- -----------------------------------------------------
-- Remove old country column
-- -----------------------------------------------------

ALTER TABLE users.profiles
DROP COLUMN country_code;

-- -----------------------------------------------------
-- Add new columns
-- -----------------------------------------------------

ALTER TABLE users.profiles

ADD COLUMN profile_photo_asset_id UUID,

ADD COLUMN cover_photo_asset_id UUID,

ADD COLUMN country_id UUID,

ADD COLUMN city_id UUID,

ADD COLUMN social_links JSONB DEFAULT '{}'::jsonb,

ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE,

ADD COLUMN profile_completed_at TIMESTAMP,

ADD COLUMN deleted_at TIMESTAMP;

-- -----------------------------------------------------
-- Helpful indexes
-- -----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_username
ON users.profiles(username);

CREATE INDEX IF NOT EXISTS idx_profiles_country
ON users.profiles(country_id);

CREATE INDEX IF NOT EXISTS idx_profiles_city
ON users.profiles(city_id);

CREATE INDEX IF NOT EXISTS idx_profiles_deleted
ON users.profiles(deleted_at);

CREATE INDEX IF NOT EXISTS idx_profiles_verified
ON users.profiles(is_verified);

COMMIT;
