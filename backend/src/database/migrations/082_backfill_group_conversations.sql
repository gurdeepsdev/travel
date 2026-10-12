BEGIN;

INSERT INTO chat.conversations(conversation_type,group_id,request_status,created_at,updated_at)
SELECT 'group',g.id,'ACCEPTED',g.created_at,g.created_at
FROM groups.groups g
WHERE g.status='ACTIVE' AND g.deleted_at IS NULL
ON CONFLICT(group_id) DO NOTHING;

COMMIT;
