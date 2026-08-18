BEGIN;

-- =====================================================
-- Table: users.blocked_users
-- =====================================================
-- Purpose:
-- Stores user blocking relationships.
-- A blocked user should not be able to interact with
-- the blocker across supported platform features.
-- =====================================================

CREATE TABLE IF NOT EXISTS users.blocked_users (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    blocked_user_id UUID NOT NULL,

    reason TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ----------------------------------------------------
    -- Constraints
    ----------------------------------------------------

    CONSTRAINT chk_block_self
        CHECK (user_id <> blocked_user_id),

    CONSTRAINT uq_blocked_users
        UNIQUE (user_id, blocked_user_id),

    CONSTRAINT fk_blocked_users_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_blocked_users_blocked_user
        FOREIGN KEY (blocked_user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE

);

----------------------------------------------------
-- Indexes
----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_blocked_users_user
ON users.blocked_users(user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
ON users.blocked_users(blocked_user_id);

COMMIT;
