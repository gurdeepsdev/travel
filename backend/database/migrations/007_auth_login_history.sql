BEGIN;

CREATE TABLE IF NOT EXISTS auth.login_history
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    identifier VARCHAR(255) NOT NULL,

    provider VARCHAR(50) NOT NULL,

    ip_address VARCHAR(100),

    user_agent TEXT,

    status VARCHAR(50) NOT NULL,

    failure_reason VARCHAR(255),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_login_history_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_login_history_user_id
ON auth.login_history(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_login_history_identifier
ON auth.login_history(identifier);

CREATE INDEX IF NOT EXISTS idx_auth_login_history_created_at
ON auth.login_history(created_at);

COMMENT ON TABLE auth.login_history
IS 'Stores login attempt history.';

COMMENT ON COLUMN auth.login_history.id
IS 'Primary key.';

COMMENT ON COLUMN auth.login_history.user_id
IS 'Reference to auth.users.';

COMMENT ON COLUMN auth.login_history.identifier
IS 'Phone number or email used for login.';

COMMENT ON COLUMN auth.login_history.provider
IS 'Authentication provider.';

COMMENT ON COLUMN auth.login_history.ip_address
IS 'Client IP address.';

COMMENT ON COLUMN auth.login_history.user_agent
IS 'Client user agent.';

COMMENT ON COLUMN auth.login_history.status
IS 'Login result.';

COMMENT ON COLUMN auth.login_history.failure_reason
IS 'Failure reason if login failed.';

COMMENT ON COLUMN auth.login_history.created_at
IS 'Login timestamp.';

COMMIT;