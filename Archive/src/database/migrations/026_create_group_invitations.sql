BEGIN;

CREATE TABLE groups.group_invitations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL,

    invited_user_id UUID NOT NULL,

    invited_by UUID NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    message TEXT,

    expires_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_group_invitations_group
        FOREIGN KEY (group_id)
        REFERENCES groups.groups(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_group_invited_user
        FOREIGN KEY (invited_user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_group_invited_by
        FOREIGN KEY (invited_by)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_group_invitation_status
        CHECK
        (
            status IN
            (
                'PENDING',
                'ACCEPTED',
                'DECLINED',
                'EXPIRED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_group_invitations_group
ON groups.group_invitations(group_id);

CREATE INDEX idx_group_invitations_user
ON groups.group_invitations(invited_user_id);

CREATE INDEX idx_group_invitations_status
ON groups.group_invitations(status);

CREATE INDEX idx_group_invitations_expires_at
ON groups.group_invitations(expires_at);

CREATE INDEX idx_group_invitations_created_at
ON groups.group_invitations(created_at);

COMMIT;