BEGIN;

LOCK TABLE explore.comments
IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION
  explore.update_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE explore.posts
    SET
      comment_count =
        comment_count + 1,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = NEW.post_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE explore.posts
    SET
      comment_count =
        GREATEST(
          comment_count - 1,
          0
        ),
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = OLD.post_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS
  trg_comments_update_post_count
ON explore.comments;

CREATE TRIGGER
  trg_comments_update_post_count
AFTER INSERT OR DELETE
ON explore.comments
FOR EACH ROW
EXECUTE FUNCTION
  explore.update_post_comment_count();

UPDATE explore.posts post
SET
  comment_count =
    source.actual_comment_count
FROM (
  SELECT
    target_post.id AS post_id,

    COUNT(comment.id)::integer
      AS actual_comment_count

  FROM explore.posts target_post

  LEFT JOIN explore.comments comment
    ON comment.post_id =
      target_post.id

  GROUP BY target_post.id
) AS source
WHERE post.id =
    source.post_id
  AND post.comment_count IS DISTINCT FROM
    source.actual_comment_count;

COMMIT;