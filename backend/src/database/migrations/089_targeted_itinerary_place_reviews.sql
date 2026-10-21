BEGIN;
ALTER TABLE itinerary.itinerary_change_requests ADD COLUMN IF NOT EXISTS place_changes JSONB;
ALTER TABLE chat.chat_messages ADD COLUMN IF NOT EXISTS change_request_review_id UUID;
DROP INDEX chat.uq_chat_change_request_notice;
CREATE UNIQUE INDEX uq_chat_change_request_notice
  ON chat.chat_messages(conversation_id,change_request_id,change_request_status,
    (COALESCE(change_request_review_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  WHERE change_request_id IS NOT NULL;
COMMIT;
