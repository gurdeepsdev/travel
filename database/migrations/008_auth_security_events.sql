BEGIN;

CREATE TABLE IF NOT EXISTS auth.security_events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    event_type VARCHAR(100) NOT NULL,

    ip_address VARCHAR(100),

    user_agent TEXT,

    metadata JSON,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_security_events_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_id
ON auth.security_events(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_type
ON auth.security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at
ON auth.security_events(created_at);

COMMENT ON TABLE auth.security_events
IS 'Stores authentication security events.';

COMMENT ON COLUMN auth.security_events.id
IS 'Primary key.';

COMMENT ON COLUMN auth.security_events.user_id
IS 'Reference to auth.users.';

COMMENT ON COLUMN auth.security_events.event_type
IS 'Security event type.';

COMMENT ON COLUMN auth.security_events.ip_address
IS 'Client IP address.';

COMMENT ON COLUMN auth.security_events.user_agent
IS 'Client user agent.';

COMMENT ON COLUMN auth.security_events.metadata
IS 'Additional event information.';

COMMENT ON COLUMN auth.security_events.created_at
IS 'Event timestamp.';

COMMIT;