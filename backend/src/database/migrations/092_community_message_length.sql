BEGIN;
ALTER TABLE chat.chat_messages ALTER COLUMN message_content TYPE VARCHAR(4096);
COMMIT;
