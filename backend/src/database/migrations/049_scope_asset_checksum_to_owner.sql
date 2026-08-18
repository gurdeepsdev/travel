BEGIN;

LOCK TABLE media.assets
IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM media.assets asset
    GROUP BY
      asset.uploaded_by,
      asset.checksum
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create owner-scoped asset checksum constraint because duplicate owner/checksum rows exist.';
  END IF;
END;
$migration$;

ALTER TABLE media.assets
DROP CONSTRAINT
  uq_assets_checksum;

ALTER TABLE media.assets
ADD CONSTRAINT
  uq_assets_owner_checksum
UNIQUE (
  uploaded_by,
  checksum
);

COMMIT;