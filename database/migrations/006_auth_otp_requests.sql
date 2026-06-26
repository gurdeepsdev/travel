BEGIN;

CREATE TABLE IF NOT EXISTS auth.otp_requests
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    identifier VARCHAR(255) NOT NULL,

    provider VARCHAR(50) NOT NULL,

    otp_hash TEXT NOT NULL,

    attempt_count INTEGER NOT NULL DEFAULT 0,

    expires_at TIMESTAMP NOT NULL,

    verified_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_identifier
ON auth.otp_requests(identifier);

CREATE INDEX IF NOT EXISTS idx_auth_otp_expires
ON auth.otp_requests(expires_at);

COMMENT ON TABLE auth.otp_requests
IS 'Stores OTP requests.';

COMMENT ON COLUMN auth.otp_requests.id
IS 'Primary key.';

COMMENT ON COLUMN auth.otp_requests.identifier
IS 'Phone number or email address.';

COMMENT ON COLUMN auth.otp_requests.provider
IS 'OTP provider used.';

COMMENT ON COLUMN auth.otp_requests.otp_hash
IS 'BCrypt hash of generated OTP.';

COMMENT ON COLUMN auth.otp_requests.attempt_count
IS 'Number of verification attempts.';

COMMENT ON COLUMN auth.otp_requests.expires_at
IS 'OTP expiry timestamp.';

COMMENT ON COLUMN auth.otp_requests.verified_at
IS 'Verification timestamp.';

COMMENT ON COLUMN auth.otp_requests.created_at
IS 'Creation timestamp.';

COMMIT;