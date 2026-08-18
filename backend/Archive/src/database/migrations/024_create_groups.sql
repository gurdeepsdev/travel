BEGIN;

CREATE TABLE groups.groups
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,

    description TEXT,

    cover_asset_id UUID,

    itinerary_id UUID UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_groups_owner
        FOREIGN KEY (owner_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_groups_cover_asset
        FOREIGN KEY (cover_asset_id)
        REFERENCES media.assets(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_groups_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_group_status
        CHECK
        (
            status IN
            (
                'ACTIVE',
                'ARCHIVED'
            )
        )
);

CREATE INDEX idx_groups_owner
ON groups.groups(owner_id);

CREATE INDEX idx_groups_status
ON groups.groups(status);

CREATE INDEX idx_groups_created_at
ON groups.groups(created_at);

CREATE INDEX idx_groups_deleted_at
ON groups.groups(deleted_at);

COMMIT;