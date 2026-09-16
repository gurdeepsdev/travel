BEGIN;

ALTER TABLE media.assets
  ADD COLUMN IF NOT EXISTS hls_manifest_storage_key TEXT;

COMMIT;
