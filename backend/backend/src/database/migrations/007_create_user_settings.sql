BEGIN;

-- =====================================================
-- Table: users.user_settings
-- =====================================================
-- Purpose:
-- Stores application/UI settings for each user.
-- This table is separate from AI travel preferences.
-- =====================================================

CREATE TABLE IF NOT EXISTS users.user_settings (

    user_id UUID PRIMARY KEY,

    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_settings_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE

);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_settings_updated_at
ON users.user_settings(updated_at);

COMMIT;
