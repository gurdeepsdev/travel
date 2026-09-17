BEGIN;

ALTER TABLE itinerary.itineraries
  ALTER COLUMN visibility SET DEFAULT 'public';

COMMIT;
