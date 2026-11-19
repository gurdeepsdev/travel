BEGIN;

ALTER TABLE users.collection
  ADD COLUMN review_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING','VERIFIED','REJECTED')),
  ADD COLUMN review_details jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE users.collection SET review_status='VERIFIED' WHERE verification_status IS TRUE;

CREATE TABLE users.visit_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type varchar(5) NOT NULL CHECK (target_type IN ('CITY','PLACE')),
  submission_id uuid NOT NULL,
  evidence_asset_id uuid NOT NULL REFERENCES media.assets(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  decision varchar(8) NOT NULL CHECK (decision IN ('VERIFIED','REJECTED')),
  reason varchar(1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(target_type,submission_id,evidence_asset_id),
  CHECK (decision <> 'REJECTED' OR coalesce(length(btrim(reason)),0) > 0)
);

CREATE FUNCTION users.sync_city_visit_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.review_status := CASE WHEN NEW.verification_status IS TRUE THEN 'VERIFIED' ELSE 'PENDING' END;
  ELSIF NEW.verification_asset_id IS DISTINCT FROM OLD.verification_asset_id THEN
    NEW.review_status := CASE WHEN NEW.verification_status IS TRUE THEN 'VERIFIED' ELSE 'PENDING' END;
    NEW.review_details := '{}'::jsonb;
  ELSIF NEW.verification_status IS TRUE THEN
    NEW.review_status := 'VERIFIED';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_city_visit_review BEFORE INSERT OR UPDATE ON users.collection
FOR EACH ROW EXECUTE FUNCTION users.sync_city_visit_review();
CREATE INDEX idx_city_visit_pending ON users.collection(created_at DESC,id DESC)
  WHERE verification_asset_id IS NOT NULL AND review_status='PENDING';
COMMIT;
