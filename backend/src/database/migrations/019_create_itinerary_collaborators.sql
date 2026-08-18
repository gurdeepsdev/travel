BEGIN;

CREATE TABLE itinerary.itinerary_collaborators
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    itinerary_id UUID NOT NULL,

    user_id UUID NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'viewer',

    invited_by UUID NOT NULL,

    invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    joined_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_itinerary_collaborators_itinerary
        FOREIGN KEY (itinerary_id)
        REFERENCES itinerary.itineraries(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_collaborators_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itinerary_collaborators_invited_by
        FOREIGN KEY (invited_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_itinerary_collaborator
        UNIQUE
        (
            itinerary_id,
            user_id
        ),

    CONSTRAINT chk_collaborator_role
        CHECK
        (
            role IN
            (
                'owner',
                'admin',
                'editor',
                'viewer'
            )
        ),

    CONSTRAINT chk_invitation_status
        CHECK
        (
            invitation_status IN
            (
                'pending',
                'accepted',
                'declined',
                'removed'
            )
        )
);

CREATE INDEX idx_itinerary_collaborators_itinerary
ON itinerary.itinerary_collaborators(itinerary_id);

CREATE INDEX idx_itinerary_collaborators_user
ON itinerary.itinerary_collaborators(user_id);

CREATE INDEX idx_itinerary_collaborators_role
ON itinerary.itinerary_collaborators(role);

CREATE INDEX idx_itinerary_collaborators_status
ON itinerary.itinerary_collaborators(invitation_status);

CREATE INDEX idx_itinerary_collaborators_invited_by
ON itinerary.itinerary_collaborators(invited_by);

COMMIT;
