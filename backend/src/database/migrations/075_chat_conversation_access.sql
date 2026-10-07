BEGIN;

ALTER TABLE chat.conversations
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES community.communities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS request_status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE chat.conversations DROP CONSTRAINT IF EXISTS chk_conversations_type;
ALTER TABLE chat.conversations DROP CONSTRAINT IF EXISTS chk_conversations_group_requirement;
ALTER TABLE chat.conversations DROP CONSTRAINT IF EXISTS chk_conversations_direct_key;
ALTER TABLE chat.conversations ADD CONSTRAINT chk_conversations_type
  CHECK (conversation_type IN ('direct', 'group', 'community'));
ALTER TABLE chat.conversations ADD CONSTRAINT chk_conversations_target
  CHECK (
    (conversation_type = 'direct' AND direct_key IS NOT NULL AND group_id IS NULL AND community_id IS NULL)
    OR (conversation_type = 'group' AND group_id IS NOT NULL AND direct_key IS NULL AND community_id IS NULL)
    OR (conversation_type = 'community' AND community_id IS NOT NULL AND direct_key IS NULL AND group_id IS NULL)
  );
ALTER TABLE chat.conversations ADD CONSTRAINT chk_conversations_request
  CHECK (request_status IN ('PENDING', 'ACCEPTED', 'REJECTED')
    AND (conversation_type = 'direct' OR request_status = 'ACCEPTED')
    AND (request_status = 'ACCEPTED' OR requested_by IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_community ON chat.conversations(community_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_group ON chat.conversations(group_id);

COMMIT;
