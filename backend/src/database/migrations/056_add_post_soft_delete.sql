BEGIN;

ALTER TABLE explore.posts
  ADD COLUMN IF NOT EXISTS
    deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS
  idx_posts_active_created_at
ON explore.posts (
  created_at DESC,
  id DESC
)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS
  idx_posts_active_user_created_at
ON explore.posts (
  user_id,
  created_at DESC,
  id DESC
)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN
  explore.posts.deleted_at
IS
  'Soft-deletion timestamp. NULL means the post is active.';

COMMIT;
