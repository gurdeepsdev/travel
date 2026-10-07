BEGIN;
ALTER TABLE chat.chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id UUID,
  ADD COLUMN IF NOT EXISTS client_payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_client_message ON chat.chat_messages(conversation_id,sent_by,client_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_history ON chat.chat_messages(conversation_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS chat.hidden_messages (
  message_id UUID REFERENCES chat.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS chat.message_receipts (
  message_id UUID REFERENCES chat.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS chat.event_outbox (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat.chat_messages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_pending_events ON chat.event_outbox(id) WHERE processed_at IS NULL;
COMMIT;
