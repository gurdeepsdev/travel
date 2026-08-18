BEGIN;

-- =====================================================
-- Table: users.visited_places
-- =====================================================
-- Purpose:
-- Stores every visit made by a user to a place.
-- One user may visit the same place multiple times.
-- Powers travel history, AI recommendations,
-- statistics, badges, timelines and memories.
-- =====================================================

CREATE TABLE IF NOT EXISTS users.visited_places (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    poi_id UUID NOT NULL,

    itinerary_id UUID,

    arrival_date DATE NOT NULL,

    departure_date DATE,

    visit_type VARCHAR(30) NOT NULL DEFAULT 'personal',

    rating SMALLINT,

    notes TEXT,

    visibility VARCHAR(20) NOT NULL DEFAULT 'private',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ----------------------------------------------------
    -- Constraints
    ----------------------------------------------------

    CONSTRAINT chk_visit_rating
        CHECK (
            rating IS NULL
            OR rating BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_visit_dates
        CHECK (
            departure_date IS NULL
            OR departure_date >= arrival_date
        ),

    CONSTRAINT chk_visit_type
        CHECK (
            visit_type IN (
                'personal',
                'business',
                'transit',
                'roadtrip',
                'layover',
                'daytrip'
            )
        ),

    CONSTRAINT chk_visit_visibility
        CHECK (
            visibility IN (
                'private',
                'friends',
                'public'
            )
        ),

    CONSTRAINT fk_visited_places_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE

);

----------------------------------------------------
-- Indexes
----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_visited_places_user
ON users.visited_places(user_id);

CREATE INDEX IF NOT EXISTS idx_visited_places_poi
ON users.visited_places(poi_id);

CREATE INDEX IF NOT EXISTS idx_visited_places_arrival
ON users.visited_places(arrival_date);

CREATE INDEX IF NOT EXISTS idx_visited_places_visit_type
ON users.visited_places(visit_type);

CREATE INDEX IF NOT EXISTS idx_visited_places_rating
ON users.visited_places(rating);

CREATE INDEX IF NOT EXISTS idx_visited_places_visibility
ON users.visited_places(visibility);

CREATE INDEX IF NOT EXISTS idx_visited_places_itinerary
ON users.visited_places(itinerary_id);

COMMIT;
