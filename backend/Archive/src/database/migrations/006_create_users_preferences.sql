BEGIN;

-- =====================================================
-- Table: users.preferences
-- =====================================================
-- Purpose:
-- Stores the AI preference profile for every user.
-- One user can have only one preference profile.
-- =====================================================

CREATE TABLE IF NOT EXISTS users.preferences (

    user_id UUID PRIMARY KEY,

    preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE

);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_preferences_updated_at
ON users.preferences(updated_at);

COMMIT;
