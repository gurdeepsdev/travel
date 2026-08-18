BEGIN;

CREATE TABLE itinerary.itinerary_shares
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    share_token VARCHAR(128) NOT NULL,

    access_type VARCHAR(20) NOT NULL DEFAULT 'private',

    password_hash TEXT,

    expires_at TIMESTAMP,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_itinerary_shares_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_shares_created_by
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_itinerary_share_token
        UNIQUE (share_token),

    CONSTRAINT chk_access_type
        CHECK
        (
            access_type IN
            (
                'private',
                'public',
                'password'
            )
        )
);

CREATE INDEX idx_itinerary_shares_itinerary
ON itinerary.itinerary_shares(itinerary_id);

CREATE INDEX idx_itinerary_shares_created_by
ON itinerary.itinerary_shares(created_by);

CREATE INDEX idx_itinerary_shares_active
ON itinerary.itinerary_shares(is_active);

CREATE INDEX idx_itinerary_shares_expires_at
ON itinerary.itinerary_shares(expires_at);

COMMIT;
