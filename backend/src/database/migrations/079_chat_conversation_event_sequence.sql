BEGIN;
LOCK TABLE chat.conversations, chat.event_outbox, chat.user_events IN ACCESS EXCLUSIVE MODE;
ALTER TABLE chat.conversations ADD COLUMN event_sequence BIGINT NOT NULL DEFAULT 0 CHECK(event_sequence>=0);
ALTER TABLE chat.event_outbox ADD COLUMN conversation_sequence BIGINT;
ALTER TABLE chat.user_events ADD COLUMN conversation_sequence BIGINT;
WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY id) AS sequence FROM chat.event_outbox
)
UPDATE chat.event_outbox e SET conversation_sequence=r.sequence FROM ranked r WHERE r.id=e.id;
UPDATE chat.user_events u SET conversation_sequence=e.conversation_sequence FROM chat.event_outbox e WHERE e.id=u.event_id;
UPDATE chat.conversations c SET event_sequence=s.maximum FROM (
  SELECT conversation_id,MAX(conversation_sequence) AS maximum FROM chat.event_outbox GROUP BY conversation_id
) s WHERE c.id=s.conversation_id;
ALTER TABLE chat.event_outbox ALTER COLUMN conversation_sequence SET NOT NULL;
CREATE UNIQUE INDEX uq_chat_conversation_sequence ON chat.event_outbox(conversation_id,conversation_sequence);
CREATE FUNCTION chat.assign_conversation_sequence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chat.conversations SET event_sequence=event_sequence+1 WHERE id=NEW.conversation_id
    RETURNING event_sequence INTO NEW.conversation_sequence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chat_event_sequence BEFORE INSERT ON chat.event_outbox
FOR EACH ROW EXECUTE FUNCTION chat.assign_conversation_sequence();
COMMIT;
