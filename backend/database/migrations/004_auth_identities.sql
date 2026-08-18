BEGIN;

CREATE TABLE IF NOT EXISTS auth.identities
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    provider VARCHAR(50) NOT NULL,

    provider_identifier VARCHAR(255) NOT NULL,

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_identities_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id
ON auth.identities(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_identities_provider
ON auth.identities(provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_identifier
ON auth.identities(provider, provider_identifier);

COMMENT ON TABLE auth.identities
IS 'Stores authentication identities for users.';

COMMENT ON COLUMN auth.identities.id
IS 'Primary key.';

COMMENT ON COLUMN auth.identities.user_id
IS 'Reference to auth.users.';

COMMENT ON COLUMN auth.identities.provider
IS 'Authentication provider.';

COMMENT ON COLUMN auth.identities.provider_identifier
IS 'Unique identifier received from the provider.';

COMMENT ON COLUMN auth.identities.is_verified
IS 'Whether the identity has been verified.';

COMMENT ON COLUMN auth.identities.is_primary
IS 'Whether this is the primary identity.';

COMMENT ON COLUMN auth.identities.created_at
IS 'Creation timestamp.';

COMMENT ON COLUMN auth.identities.updated_at
IS 'Last update timestamp.';

COMMIT;