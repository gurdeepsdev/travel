CREATE SCHEMA IF NOT EXISTS infrastructure;

CREATE TABLE IF NOT EXISTS infrastructure.engagement_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id uuid NOT NULL,
  event_type varchar(80) NOT NULL,
  actor_user_id uuid,
  comment_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_engagement_outbox_pending
  ON infrastructure.engagement_outbox (id)
  WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION infrastructure.capture_post_engagement_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_post_id uuid;
  resolved_actor_user_id uuid;
  resolved_comment_id uuid;
  resolved_event_type varchar(80);
BEGIN
  IF TG_TABLE_NAME = 'comments' THEN
    IF TG_OP = 'DELETE' THEN
      resolved_post_id := OLD.post_id;
      resolved_actor_user_id := OLD.user_id;
      resolved_comment_id := OLD.id;
    ELSE
      resolved_post_id := NEW.post_id;
      resolved_actor_user_id := NEW.user_id;
      resolved_comment_id := NEW.id;
    END IF;
    resolved_event_type := 'post.comments.updated';
  ELSIF TG_TABLE_NAME = 'comment_likes' THEN
    IF TG_OP = 'DELETE' THEN
      resolved_actor_user_id := OLD.user_id;
      resolved_comment_id := OLD.comment_id;
    ELSE
      resolved_actor_user_id := NEW.user_id;
      resolved_comment_id := NEW.comment_id;
    END IF;

    SELECT comment.post_id
    INTO resolved_post_id
    FROM explore.comments comment
    WHERE comment.id = resolved_comment_id;

    resolved_event_type := 'comment.likes.updated';
  ELSIF TG_TABLE_NAME = 'post_likes' THEN
    IF TG_OP = 'DELETE' THEN
      resolved_post_id := OLD.post_id;
      resolved_actor_user_id := OLD.user_id;
    ELSE
      resolved_post_id := NEW.post_id;
      resolved_actor_user_id := NEW.user_id;
    END IF;
    resolved_event_type := 'post.reactions.updated';
  ELSE
    IF TG_OP = 'DELETE' THEN
      resolved_post_id := OLD.post_id;
      resolved_actor_user_id := OLD.user_id;
    ELSE
      resolved_post_id := NEW.post_id;
      resolved_actor_user_id := NEW.user_id;
    END IF;
    resolved_event_type := 'post.been_there.updated';
  END IF;

  IF resolved_post_id IS NOT NULL THEN
    INSERT INTO infrastructure.engagement_outbox (
      post_id,
      event_type,
      actor_user_id,
      comment_id
    ) VALUES (
      resolved_post_id,
      resolved_event_type,
      resolved_actor_user_id,
      resolved_comment_id
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_likes_engagement_outbox
  ON explore.post_likes;
CREATE TRIGGER trg_post_likes_engagement_outbox
AFTER INSERT OR UPDATE OR DELETE ON explore.post_likes
FOR EACH ROW EXECUTE FUNCTION infrastructure.capture_post_engagement_event();

DROP TRIGGER IF EXISTS trg_post_been_there_engagement_outbox
  ON explore.post_been_there;
CREATE TRIGGER trg_post_been_there_engagement_outbox
AFTER INSERT OR DELETE ON explore.post_been_there
FOR EACH ROW EXECUTE FUNCTION infrastructure.capture_post_engagement_event();

DROP TRIGGER IF EXISTS trg_comments_engagement_outbox
  ON explore.comments;
CREATE TRIGGER trg_comments_engagement_outbox
AFTER INSERT OR DELETE ON explore.comments
FOR EACH ROW EXECUTE FUNCTION infrastructure.capture_post_engagement_event();

DROP TRIGGER IF EXISTS trg_comment_likes_engagement_outbox
  ON explore.comment_likes;
CREATE TRIGGER trg_comment_likes_engagement_outbox
AFTER INSERT OR DELETE ON explore.comment_likes
FOR EACH ROW EXECUTE FUNCTION infrastructure.capture_post_engagement_event();
