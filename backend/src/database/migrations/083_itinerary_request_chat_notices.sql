BEGIN;
ALTER TABLE chat.chat_messages
  ADD COLUMN IF NOT EXISTS change_request_id UUID REFERENCES itinerary.itinerary_change_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_request_status VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_change_request_notice
  ON chat.chat_messages(conversation_id,change_request_id,change_request_status)
  WHERE change_request_id IS NOT NULL;
COMMIT;
