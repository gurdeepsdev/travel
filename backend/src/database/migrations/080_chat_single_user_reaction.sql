BEGIN;

LOCK TABLE chat.message_reactions IN ACCESS EXCLUSIVE MODE;

-- Keep the latest reaction; UUID breaks ties in legacy timestamps.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY message_id, user_id ORDER BY created_at DESC, id DESC
  ) AS position
  FROM chat.message_reactions
)
DELETE FROM chat.message_reactions reaction
USING ranked
WHERE reaction.id = ranked.id AND ranked.position > 1;

ALTER TABLE chat.message_reactions
  DROP CONSTRAINT IF EXISTS uq_message_reactions_message_user_reaction;
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_reactions_message_user
  ON chat.message_reactions (message_id, user_id);

COMMIT;
