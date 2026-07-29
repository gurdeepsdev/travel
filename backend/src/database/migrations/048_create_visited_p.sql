BEGIN;

-- =====================================================
-- TABLE: users.visited_places
-- PURPOSE: Stores places actually visited by users
-- =====================================================

CREATE TABLE users.visited_places
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    place_id UUID NOT NULL,

    trip_id UUID,

    verification_asset_id UUID,

    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    visit_source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',

    visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- CHECK CONSTRAINTS
    -- =====================================================

    CONSTRAINT chk_verification_status
        CHECK (
            verification_status IN (
                'PENDING',
                'VERIFIED',
                'REJECTED'
            )
        ),

    CONSTRAINT chk_visit_source
        CHECK (
            visit_source IN (
                'MANUAL',
                'TRIP_COMPLETION',
                'PHOTO_VERIFICATION',
                'ADMIN'
            )
        ),

    CONSTRAINT uq_user_place_visit
        UNIQUE (user_id, place_id),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_visited_places_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,



    CONSTRAINT fk_visited_places_trip
        FOREIGN KEY (trip_id)
        REFERENCES trip.trips(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_visited_places_asset
        FOREIGN KEY (verification_asset_id)
        REFERENCES media.assets(id)
        ON DELETE SET NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_visited_places_user
ON users.visited_places(user_id);

CREATE INDEX idx_visited_places_place
ON users.visited_places(place_id);

CREATE INDEX idx_visited_places_trip
ON users.visited_places(trip_id);

CREATE INDEX idx_visited_places_status
ON users.visited_places(verification_status);

CREATE INDEX idx_visited_places_source
ON users.visited_places(visit_source);

CREATE INDEX idx_visited_places_visited_at
ON users.visited_places(visited_at);

CREATE INDEX idx_visited_places_created_at
ON users.visited_places(created_at);

COMMIT;