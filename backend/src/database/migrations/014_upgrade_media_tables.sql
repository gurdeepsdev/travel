BEGIN;

----------------------------------------------------------
-- media.assets
----------------------------------------------------------

ALTER TABLE media.assets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE media.assets
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

----------------------------------------------------------
-- media.asset_variants
----------------------------------------------------------

ALTER TABLE media.asset_variants
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

COMMIT;
