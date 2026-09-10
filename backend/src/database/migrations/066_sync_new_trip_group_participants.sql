BEGIN;

CREATE OR REPLACE FUNCTION trip.ensure_group_participants()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.itinerary_id::text, 0));
  INSERT INTO trip.trip_participants(trip_id,user_id,added_by)
  SELECT NEW.id, member.user_id, member.added_by
  FROM groups.group_members member
  JOIN groups.groups g ON g.id=member.group_id
  WHERE g.itinerary_id=NEW.itinerary_id AND g.status='ACTIVE'
    AND g.deleted_at IS NULL AND member.status='ACTIVE'
  ON CONFLICT (trip_id,user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_group_participants ON trip.trips;
CREATE TRIGGER trg_trips_group_participants AFTER INSERT ON trip.trips
FOR EACH ROW EXECUTE FUNCTION trip.ensure_group_participants();

COMMIT;
