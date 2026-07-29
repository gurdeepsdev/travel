BEGIN;

CREATE TABLE itinerary.itinerary_forks
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    original_itinerary_id UUID NOT NULL,

    forked_itinerary_id UUID NOT NULL,

    forked_by UUID NOT NULL,

    fork_reason TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_itinerary_forks_original
        FOREIGN KEY (original_itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_forks_forked
        FOREIGN KEY (forked_itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_forks_user
        FOREIGN KEY (forked_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_itinerary_fork
        UNIQUE
        (
            original_itinerary_id,
            forked_itinerary_id
        ),

    CONSTRAINT chk_not_self_fork
        CHECK
        (
            original_itinerary_id <> forked_itinerary_id
        )
);

CREATE INDEX idx_itinerary_forks_original
ON itinerary.itinerary_forks(original_itinerary_id);

CREATE INDEX idx_itinerary_forks_forked
ON itinerary.itinerary_forks(forked_itinerary_id);

CREATE INDEX idx_itinerary_forks_user
ON itinerary.itinerary_forks(forked_by);

CREATE INDEX idx_itinerary_forks_created_at
ON itinerary.itinerary_forks(created_at);

COMMIT;
