BEGIN;

ALTER TABLE media.assets
  ADD COLUMN IF NOT EXISTS processing_status
    VARCHAR(20) NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS processing_error
    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS processed_at
    TIMESTAMP;

ALTER TABLE media.assets
  DROP CONSTRAINT IF EXISTS
    chk_assets_processing_status;

ALTER TABLE media.assets
  ADD CONSTRAINT chk_assets_processing_status
  CHECK (
    processing_status IN (
      'PROCESSING',
      'READY',
      'FAILED'
    )
  );

CREATE INDEX IF NOT EXISTS
  idx_assets_video_processing_status
ON media.assets (
  processing_status,
  created_at
)
WHERE mime_type LIKE 'video/%'
  AND deleted_at IS NULL;

COMMIT;
