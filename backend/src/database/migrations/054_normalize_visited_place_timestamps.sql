BEGIN;

ALTER TABLE users.visited_places
  ALTER COLUMN visited_at
    TYPE TIMESTAMPTZ
    USING (
      visited_at
      AT TIME ZONE 'UTC'
    ),

  ALTER COLUMN created_at
    TYPE TIMESTAMPTZ
    USING (
      created_at
      AT TIME ZONE 'UTC'
    ),

  ALTER COLUMN updated_at
    TYPE TIMESTAMPTZ
    USING (
      updated_at
      AT TIME ZONE 'UTC'
    );

COMMENT ON COLUMN
  users.visited_places.visited_at
IS
  'Verified visit time stored as an absolute timestamp with timezone.';

COMMENT ON COLUMN
  users.visited_places.created_at
IS
  'Creation time stored as an absolute timestamp with timezone.';

COMMENT ON COLUMN
  users.visited_places.updated_at
IS
  'Most recent update time stored as an absolute timestamp with timezone.';

COMMIT;

