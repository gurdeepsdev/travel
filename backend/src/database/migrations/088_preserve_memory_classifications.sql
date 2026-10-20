BEGIN;

ALTER TABLE users.memories
  DROP CONSTRAINT uq_memories_user_asset,
  ADD CONSTRAINT uq_memories_user_asset_type
    UNIQUE (user_id, asset_id, memory_type);

COMMIT;
