BEGIN;
CREATE TABLE chat.event_cursors (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE chat.user_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  message_id UUID,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,sequence),
  UNIQUE(user_id,event_id)
);
CREATE INDEX idx_chat_replay_retention ON chat.user_events(created_at);
COMMIT;
