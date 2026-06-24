-- =====================================================
-- AUTH TABLES
-- =====================================================

-- =====================================================
-- auth.users
-- =====================================================

CREATE TABLE auth.users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

```
ytenant_id UUID NOT NULL,

status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deactivated', 'suspended')),

deactivated_at TIMESTAMP NULL,

created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMP NULL
```

);

-- =====================================================
-- auth.identities
-- =====================================================

CREATE TABLE auth.identities (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

```
user_id UUID NOT NULL,

provider VARCHAR(50) NOT NULL
    CHECK (
        provider IN (
            'phone',
            'email',
            'google',
            'apple',
            'facebook'
        )
    ),

provider_identifier VARCHAR(255) NOT NULL,

is_verified BOOLEAN NOT NULL DEFAULT FALSE,

is_primary BOOLEAN NOT NULL DEFAULT FALSE,

created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

CONSTRAINT fk_identity_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
```

);

CREATE UNIQUE INDEX uq_identity_provider_identifier
ON auth.identities(provider, provider_identifier);

CREATE INDEX idx_identity_user_id
ON auth.identities(user_id);

-- =====================================================
-- auth.sessions
-- =====================================================

CREATE TABLE auth.sessions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

```
user_id UUID NOT NULL,

device_type VARCHAR(50),

device_name VARCHAR(255),

refresh_token_hash TEXT NOT NULL,

last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),

expires_at TIMESTAMP NOT NULL,

created_at TIMESTAMP NOT NULL DEFAULT NOW(),

CONSTRAINT fk_session_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
```

);

CREATE INDEX idx_sessions_user_id
ON auth.sessions(user_id);

CREATE INDEX idx_sessions_expires_at
ON auth.sessions(expires_at);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at_column();

CREATE TRIGGER trg_identities_updated_at
BEFORE UPDATE ON auth.identities
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at_column();

