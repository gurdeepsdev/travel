BEGIN;

CREATE TABLE itinerary.itineraries
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    created_by UUID NOT NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    cover_asset_id UUID,

    start_date DATE,

    end_date DATE,

    duration_days SMALLINT,

    budget_amount NUMERIC(12,2),

    currency_code CHAR(3),

    visibility VARCHAR(20) NOT NULL DEFAULT 'private',

    trip_status VARCHAR(20) NOT NULL DEFAULT 'draft',

    ai_generated BOOLEAN NOT NULL DEFAULT FALSE,

    itinerary_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_itineraries_created_by
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itineraries_cover_asset
        FOREIGN KEY (cover_asset_id)
        REFERENCES media.assets(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_trip_dates
        CHECK
        (
            start_date IS NULL
            OR end_date IS NULL
            OR end_date >= start_date
        ),

    CONSTRAINT chk_duration_days
        CHECK
        (
            duration_days IS NULL
            OR duration_days > 0
        ),

    CONSTRAINT chk_budget_amount
        CHECK
        (
            budget_amount IS NULL
            OR budget_amount >= 0
        ),

    CONSTRAINT chk_visibility
        CHECK
        (
            visibility IN
            (
                'private',
                'friends',
                'public'
            )
        ),

    CONSTRAINT chk_trip_status
        CHECK
        (
            trip_status IN
            (
                'draft',
                'planned',
                'ongoing',
                'completed',
                'cancelled',
                'archived'
            )
        )
);

CREATE INDEX idx_itineraries_created_by
ON itinerary.itineraries(created_by);

CREATE INDEX idx_itineraries_visibility
ON itinerary.itineraries(visibility);

CREATE INDEX idx_itineraries_status
ON itinerary.itineraries(trip_status);

CREATE INDEX idx_itineraries_start_date
ON itinerary.itineraries(start_date);

CREATE INDEX idx_itineraries_created_at
ON itinerary.itineraries(created_at);

CREATE INDEX idx_itineraries_ai_generated
ON itinerary.itineraries(ai_generated);

COMMIT;
