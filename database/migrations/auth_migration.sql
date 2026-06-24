-- ============================================
-- AUTH FOUNDATION MIGRATION
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- IDENTITIES
-- ============================================

CREATE TABLE IF NOT EXISTS auth.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    provider VARCHAR(50) NOT NULL,

    provider_identifier VARCHAR(255) NOT NULL,

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_identity
        UNIQUE(provider, provider_identifier)
);

-- ============================================
-- SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    refresh_token_hash TEXT NOT NULL,

    device_name VARCHAR(255),
    device_type VARCHAR(50),
    device_id VARCHAR(255),

    ip_address VARCHAR(100),

    user_agent TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMP NOT NULL
);

-- ============================================
-- OTP REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS auth.otp_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider VARCHAR(50) NOT NULL,

    provider_identifier VARCHAR(255) NOT NULL,

    otp_hash VARCHAR(255) NOT NULL,

    purpose VARCHAR(50) NOT NULL,

    attempts INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    verified_at TIMESTAMP NULL,

    expires_at TIMESTAMP NOT NULL
);

-- ============================================
-- LOGIN HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS auth.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    identity_id UUID NOT NULL
        REFERENCES auth.identities(id)
        ON DELETE CASCADE,

    ip_address VARCHAR(100),

    user_agent_string TEXT,

    device_name VARCHAR(255),

    login_at TIMESTAMP NOT NULL DEFAULT NOW(),

    status VARCHAR(20) NOT NULL
);

-- ============================================
-- SECURITY EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS auth.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    identity_id UUID NULL
        REFERENCES auth.identities(id)
        ON DELETE CASCADE,

    event_type VARCHAR(100) NOT NULL,

    actor_type VARCHAR(50) NOT NULL,

    actor_id VARCHAR(255),

    metadata JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_identities_user_id
ON auth.identities(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON auth.sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id
ON auth.login_history(user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id
ON auth.security_events(user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type
ON auth.security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_otp_provider_identifier
ON auth.otp_requests(provider, provider_identifier);
