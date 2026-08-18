BEGIN;

-- =====================================================
-- TABLE: users.saved_items
-- PURPOSE: Stores all user saved content
-- =====================================================

CREATE TABLE IF NOT EXISTS users.saved_items (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    item_type VARCHAR(20) NOT NULL,

    item_id UUID NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_saved_item_type
        CHECK (
            item_type IN (
                'PLACE',
                'ITINERARY',
                'MEDIA',
                'POST'
            )
        ),

    CONSTRAINT uq_saved_item
        UNIQUE(user_id, item_type, item_id),

    CONSTRAINT fk_saved_items_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_saved_items_user
ON users.saved_items(user_id);

CREATE INDEX idx_saved_items_type
ON users.saved_items(item_type);

CREATE INDEX idx_saved_items_item
ON users.saved_items(item_id);

CREATE INDEX idx_saved_items_created_at
ON users.saved_items(created_at);

COMMIT;