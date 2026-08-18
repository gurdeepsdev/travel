BEGIN;

CREATE TABLE IF NOT EXISTS auth.users
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    status VARCHAR(50) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_users_status
ON auth.users(status);

COMMENT ON TABLE auth.users
IS 'Stores authentication users.';

COMMENT ON COLUMN auth.users.id
IS 'Primary identifier of the authenticated user.';

COMMENT ON COLUMN auth.users.status
IS 'Current account status.';

COMMENT ON COLUMN auth.users.created_at
IS 'Creation timestamp.';

COMMENT ON COLUMN auth.users.updated_at
IS 'Last update timestamp.';

COMMIT;