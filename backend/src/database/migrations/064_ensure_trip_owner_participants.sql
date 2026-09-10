BEGIN;

CREATE OR REPLACE FUNCTION trip.ensure_trip_owner_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO trip.trip_participants (
        trip_id,
        user_id,
        added_by
    )
    VALUES (
        NEW.id,
        NEW.user_id,
        NEW.user_id
    )
    ON CONFLICT (trip_id, user_id)
    DO UPDATE SET
        status = 'ACTIVE',
        removed_at = NULL,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_ensure_owner_participant
ON trip.trips;

CREATE TRIGGER trg_trips_ensure_owner_participant
AFTER INSERT OR UPDATE OF user_id
ON trip.trips
FOR EACH ROW
EXECUTE FUNCTION trip.ensure_trip_owner_participant();

INSERT INTO trip.trip_participants (
    trip_id,
    user_id,
    added_by
)
SELECT
    trip_record.id,
    trip_record.user_id,
    trip_record.user_id
FROM trip.trips trip_record
ON CONFLICT (trip_id, user_id)
DO UPDATE SET
    status = 'ACTIVE',
    removed_at = NULL,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
