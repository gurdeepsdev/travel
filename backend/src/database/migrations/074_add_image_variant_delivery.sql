BEGIN;
ALTER TABLE media.asset_variants
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE media.assets
  ADD COLUMN IF NOT EXISTS hls_renditions TEXT[];
COMMIT;
