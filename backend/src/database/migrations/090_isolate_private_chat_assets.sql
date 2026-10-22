BEGIN;

ALTER TABLE media.assets
  ADD COLUMN dedup_scope VARCHAR(20) NOT NULL DEFAULT 'general',
  ADD CONSTRAINT ck_assets_dedup_scope CHECK (dedup_scope IN ('general', 'chat_private')),
  ADD CONSTRAINT ck_assets_chat_private CHECK (
    dedup_scope <> 'chat_private' OR (storage_provider = 'local' AND is_public IS FALSE)
  );

ALTER TABLE media.assets DROP CONSTRAINT uq_assets_owner_checksum;
ALTER TABLE media.assets ADD CONSTRAINT uq_assets_owner_checksum
  UNIQUE (uploaded_by, checksum, dedup_scope);

CREATE TABLE chat.asset_optimizations (
  asset_id UUID PRIMARY KEY REFERENCES media.assets(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'READY', 'FAILED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_asset_optimization_pending ON chat.asset_optimizations(updated_at)
  WHERE status='PENDING';

COMMIT;
