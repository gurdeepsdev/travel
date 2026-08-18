BEGIN;

CREATE TABLE itinerary.itinerary_versions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    version_number INTEGER NOT NULL,

    generation_type VARCHAR(30) NOT NULL,

    snapshot_json JSONB NOT NULL,

    change_summary TEXT,

    created_by UUID NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_itinerary_versions_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_versions_created_by
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_itinerary_version
        UNIQUE (itinerary_id, version_number),

    CONSTRAINT chk_generation_type
        CHECK
        (
            generation_type IN
            (
                'MANUAL',
                'AI_GENERATED',
                'AI_REGENERATED',
                'RESTORED',
                'IMPORTED'
            )
        )
);

CREATE INDEX idx_itinerary_versions_itinerary
ON itinerary.itinerary_versions(itinerary_id);

CREATE INDEX idx_itinerary_versions_created_by
ON itinerary.itinerary_versions(created_by);

CREATE INDEX idx_itinerary_versions_created_at
ON itinerary.itinerary_versions(created_at);

COMMIT;