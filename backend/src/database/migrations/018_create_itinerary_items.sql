BEGIN;

CREATE TABLE itinerary.itinerary_items
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    day_number SMALLINT NOT NULL,

    sequence_number SMALLINT NOT NULL,

    activity_type VARCHAR(30) NOT NULL,

    poi_id UUID,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    location_name VARCHAR(255),

    start_time TIME,

    end_time TIME,

    estimated_cost NUMERIC(12,2),

    currency_code CHAR(3),

    status VARCHAR(20) NOT NULL DEFAULT 'planned',

    cover_asset_id UUID,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_itinerary_items_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

  

    CONSTRAINT fk_itinerary_items_cover_asset
        FOREIGN KEY (cover_asset_id)
        REFERENCES media.assets(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_day_number
        CHECK (day_number > 0),

    CONSTRAINT chk_sequence_number
        CHECK (sequence_number > 0),

    CONSTRAINT chk_estimated_cost
        CHECK
        (
            estimated_cost IS NULL
            OR estimated_cost >= 0
        ),

    CONSTRAINT chk_activity_status
        CHECK
        (
            status IN
            (
                'planned',
                'completed',
                'skipped',
                'cancelled'
            )
        ),

    CONSTRAINT chk_activity_type
        CHECK
        (
            activity_type IN
            (
                'poi',
                'hotel',
                'restaurant',
                'flight',
                'train',
                'bus',
                'taxi',
                'walk',
                'shopping',
                'activity',
                'transport',
                'note',
                'custom'
            )
        ),

    CONSTRAINT chk_item_time
        CHECK
        (
            start_time IS NULL
            OR end_time IS NULL
            OR end_time >= start_time
        ),

    CONSTRAINT uq_itinerary_item_order
        UNIQUE
        (
            itinerary_id,
            day_number,
            sequence_number
        )
);

CREATE INDEX idx_itinerary_items_itinerary
ON itinerary.itinerary_items(itinerary_id);

CREATE INDEX idx_itinerary_items_day
ON itinerary.itinerary_items
(
    itinerary_id,
    day_number
);

CREATE INDEX idx_itinerary_items_activity_type
ON itinerary.itinerary_items(activity_type);

CREATE INDEX idx_itinerary_items_status
ON itinerary.itinerary_items(status);

CREATE INDEX idx_itinerary_items_poi
ON itinerary.itinerary_items(poi_id);

CREATE INDEX idx_itinerary_items_cover_asset
ON itinerary.itinerary_items(cover_asset_id);

CREATE INDEX idx_itinerary_items_deleted_at
ON itinerary.itinerary_items(deleted_at);

COMMIT;
