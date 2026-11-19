BEGIN;

CREATE TABLE itinerary.visited_city_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES poi.cities(id) ON DELETE RESTRICT,
  title varchar(255),
  visit_year smallint CHECK (visit_year BETWEEN 1900 AND 9999),
  visit_month smallint CHECK (visit_month BETWEEN 1 AND 12),
  trip_type varchar(20) CHECK (trip_type IN ('FAMILY','FRIENDS','SOLO','COUPLE','OTHER')),
  attractions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(attractions) = 'array' AND jsonb_array_length(attractions) <= 200),
  itinerary_id uuid UNIQUE REFERENCES itinerary.itineraries(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id, city_id),
  CHECK ((itinerary_id IS NULL) = (completed_at IS NULL))
);

COMMIT;
