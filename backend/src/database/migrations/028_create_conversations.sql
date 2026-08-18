BEGIN;

CREATE TABLE chat.conversations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL UNIQUE,

    last_message_id UUID,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_conversations_group
        FOREIGN KEY (group_id)
        REFERENCES groups.groups(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_conversations_created_at
ON chat.conversations(created_at);

CREATE INDEX idx_conversations_updated_at
ON chat.conversations(updated_at);

CREATE INDEX idx_conversations_deleted_at
ON chat.conversations(deleted_at);

COMMIT;
