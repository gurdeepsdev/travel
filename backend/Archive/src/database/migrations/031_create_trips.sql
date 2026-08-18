BEGIN;

CREATE TABLE trip.trips
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    user_id UUID NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',

    started_at TIMESTAMP,

    completed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_trip_itinerary
        UNIQUE (itinerary_id),

    CONSTRAINT fk_trip_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_trip_status
        CHECK
        (
            status IN
            (
                'UPCOMING',
                'ONGOING',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_trip_dates
        CHECK
        (
            completed_at IS NULL
            OR
            started_at IS NULL
            OR
            completed_at >= started_at
        )
);

CREATE INDEX idx_trip_user
ON trip.trips(user_id);

CREATE INDEX idx_trip_status
ON trip.trips(status);

CREATE INDEX idx_trip_created_at
ON trip.trips(created_at);

CREATE INDEX idx_trip_updated_at
ON trip.trips(updated_at);

COMMIT;
