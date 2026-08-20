BEGIN;

ALTER TABLE explore.posts
  ADD COLUMN IF NOT EXISTS
    city_id uuid;

ALTER TABLE explore.posts
  ALTER COLUMN place_id
    DROP NOT NULL;

ALTER TABLE explore.posts
  DROP CONSTRAINT IF EXISTS
    fk_posts_city;

ALTER TABLE explore.posts
  ADD CONSTRAINT
    fk_posts_city
  FOREIGN KEY (
    city_id
  )
  REFERENCES poi.cities (
    id
  );

ALTER TABLE explore.posts
  DROP CONSTRAINT IF EXISTS
    chk_posts_location_target;

ALTER TABLE explore.posts
  ADD CONSTRAINT
    chk_posts_location_target
  CHECK (
    NUM_NONNULLS(
      place_id,
      city_id
    ) = 1
  );

CREATE INDEX IF NOT EXISTS
  idx_posts_city_created_at
ON explore.posts (
  city_id,
  created_at DESC,
  id DESC
)
WHERE city_id IS NOT NULL;

COMMENT ON COLUMN
  explore.posts.city_id
IS
  'City target for city-level posts. Mutually exclusive with place_id.';

COMMIT;
