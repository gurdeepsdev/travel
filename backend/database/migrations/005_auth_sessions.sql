BEGIN;

CREATE TABLE IF NOT EXISTS auth.sessions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    refresh_token_hash TEXT NOT NULL,

    device_name VARCHAR(255),

    device_type VARCHAR(100),

    ip_address VARCHAR(100),

    user_agent TEXT,

    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
ON auth.sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
ON auth.sessions(expires_at);

COMMENT ON TABLE auth.sessions
IS 'Stores authenticated user sessions.';

COMMENT ON COLUMN auth.sessions.id
IS 'Primary key.';

COMMENT ON COLUMN auth.sessions.user_id
IS 'Reference to auth.users.';

COMMENT ON COLUMN auth.sessions.refresh_token_hash
IS 'BCrypt hash of refresh token.';

COMMENT ON COLUMN auth.sessions.device_name
IS 'Device name.';

COMMENT ON COLUMN auth.sessions.device_type
IS 'Device type.';

COMMENT ON COLUMN auth.sessions.ip_address
IS 'Client IP address.';

COMMENT ON COLUMN auth.sessions.user_agent
IS 'Client user agent.';

COMMENT ON COLUMN auth.sessions.expires_at
IS 'Session expiry timestamp.';

COMMENT ON COLUMN auth.sessions.created_at
IS 'Creation timestamp.';

COMMIT;