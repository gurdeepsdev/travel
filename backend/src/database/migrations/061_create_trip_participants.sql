BEGIN;

CREATE TABLE trip.trip_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    added_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_trip_participants_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip.trips(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_participants_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_participants_added_by
        FOREIGN KEY (added_by)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_trip_participant
        UNIQUE (trip_id, user_id),

    CONSTRAINT chk_trip_participant_status
        CHECK (status IN ('ACTIVE', 'REMOVED')),

    CONSTRAINT chk_trip_participant_removed_at
        CHECK (
            (status = 'ACTIVE' AND removed_at IS NULL)
            OR
            (status = 'REMOVED' AND removed_at IS NOT NULL)
        )
);

CREATE INDEX idx_trip_participants_user_status
ON trip.trip_participants(user_id, status);

CREATE INDEX idx_trip_participants_trip_status
ON trip.trip_participants(trip_id, status);

CREATE TRIGGER trg_trip_participants_set_updated_at
BEFORE UPDATE ON trip.trip_participants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
ON CONFLICT (trip_id, user_id) DO NOTHING;

COMMIT;
