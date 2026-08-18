BEGIN;

CREATE TABLE trip.trip_essentials
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_id UUID NOT NULL,

    owner_id UUID NOT NULL,

    title VARCHAR(255) NOT NULL,

    category VARCHAR(30) NOT NULL,

    is_completed BOOLEAN NOT NULL DEFAULT FALSE,

    display_order SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_trip_essentials_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip.trips(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_trip_essentials_owner
        FOREIGN KEY (owner_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_trip_essentials_category
        CHECK
        (
            category IN
            (
                'DOCUMENT',
                'ELECTRONICS',
                'MEDICINE',
                'CLOTHES',
                'TOILETRIES',
                'OTHER'
            )
        ),

    CONSTRAINT chk_trip_essentials_display_order
        CHECK
        (
            display_order > 0
        )
);

CREATE INDEX idx_trip_essentials_trip
ON trip.trip_essentials(trip_id);

CREATE INDEX idx_trip_essentials_owner
ON trip.trip_essentials(owner_id);

CREATE INDEX idx_trip_essentials_category
ON trip.trip_essentials(category);

CREATE INDEX idx_trip_essentials_completed
ON trip.trip_essentials(is_completed);

CREATE INDEX idx_trip_essentials_display_order
ON trip.trip_essentials(display_order);

CREATE INDEX idx_trip_essentials_created_at
ON trip.trip_essentials(created_at);

COMMIT;
