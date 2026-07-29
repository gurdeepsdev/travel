BEGIN;

CREATE TABLE groups.group_members
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL,

    user_id UUID NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',

    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_group_members_group
        FOREIGN KEY (group_id)
        REFERENCES groups.groups(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_group_members_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_group_member
        UNIQUE
        (
            group_id,
            user_id
        ),

    CONSTRAINT chk_group_member_role
        CHECK
        (
            role IN
            (
                'OWNER',
                'ADMIN',
                'MEMBER'
            )
        )
);

CREATE INDEX idx_group_members_group
ON groups.group_members(group_id);

CREATE INDEX idx_group_members_user
ON groups.group_members(user_id);

CREATE INDEX idx_group_members_role
ON groups.group_members(role);

CREATE INDEX idx_group_members_joined_at
ON groups.group_members(joined_at);

COMMIT;
