BEGIN;
CREATE TABLE chat.conversation_settings (
  conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMP,
  last_read_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(conversation_id,user_id)
);
CREATE TABLE chat.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat.chat_messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL CHECK(reason_code IN ('SPAM','HARASSMENT','HATE_SPEECH','SEXUAL_CONTENT','VIOLENCE','SCAM','OTHER')),
  description VARCHAR(2000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','UNDER_REVIEW','RESOLVED','DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_chat_open_report ON chat.message_reports(message_id,reporter_id) WHERE status IN ('PENDING','UNDER_REVIEW');
CREATE TABLE chat.push_devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('android','ios')),
  token TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_user_push ON chat.push_devices(user_id) WHERE enabled;
CREATE TABLE chat.push_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat.chat_messages(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES chat.push_devices(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id,device_id)
);
CREATE INDEX idx_chat_due_push ON chat.push_outbox(next_attempt_at,id) WHERE completed_at IS NULL;
CREATE INDEX idx_chat_unread ON chat.chat_messages(conversation_id,created_at,id) WHERE deleted_at IS NULL;

-- Shared authorization for inbox and batched recipient lookup; never SECURITY DEFINER.
CREATE FUNCTION chat.accessible_conversations(viewer UUID)
RETURNS SETOF chat.conversations LANGUAGE SQL STABLE AS $$
 SELECT c.* FROM chat.conversations c WHERE c.deleted_at IS NULL AND (
  (c.conversation_type='direct' AND EXISTS (SELECT 1 FROM chat.conversation_participants p
    WHERE p.conversation_id=c.id AND p.user_id=viewer AND p.left_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM chat.conversation_participants p JOIN users.blocked_users b
     ON (b.user_id=viewer AND b.blocked_user_id=p.user_id) OR (b.blocked_user_id=viewer AND b.user_id=p.user_id)
     WHERE p.conversation_id=c.id AND p.user_id<>viewer))
  OR (c.conversation_type='group' AND EXISTS(SELECT 1 FROM groups.groups g WHERE g.id=c.group_id
    AND g.status='ACTIVE' AND g.deleted_at IS NULL AND (g.owner_id=viewer OR EXISTS(
      SELECT 1 FROM groups.group_members m WHERE m.group_id=g.id AND m.user_id=viewer AND m.status='ACTIVE'))))
  OR (c.conversation_type='community' AND EXISTS(SELECT 1 FROM community.communities cm WHERE cm.id=c.community_id
    AND cm.deleted_at IS NULL AND (cm.owner_id=viewer OR EXISTS(SELECT 1 FROM community.community_members m
      WHERE m.community_id=cm.id AND m.user_id=viewer AND upper(m.status)='ACTIVE'))
    AND NOT EXISTS(SELECT 1 FROM community.community_bans b WHERE b.community_id=cm.id AND b.banned_user_id=viewer)))
 );
$$;
COMMIT;
