BEGIN;

ALTER TABLE groups.group_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS added_by UUID,
  ADD COLUMN IF NOT EXISTS removed_by UUID;

UPDATE groups.group_members member
SET
  status = COALESCE(member.status, 'ACTIVE'),
  added_by = COALESCE(member.added_by, user_group.owner_id)
FROM groups.groups user_group
WHERE user_group.id = member.group_id
  AND (
    member.status IS NULL
    OR member.added_by IS NULL
  );

ALTER TABLE groups.group_members
  ALTER COLUMN status SET DEFAULT 'ACTIVE',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN added_by SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_group_member_status'
      AND conrelid = 'groups.group_members'::regclass
  ) THEN
    ALTER TABLE groups.group_members
      ADD CONSTRAINT chk_group_member_status
      CHECK (status IN ('ACTIVE', 'REMOVED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_group_member_removed_at'
      AND conrelid = 'groups.group_members'::regclass
  ) THEN
    ALTER TABLE groups.group_members
      ADD CONSTRAINT chk_group_member_removed_at
      CHECK (
        (status = 'ACTIVE' AND removed_at IS NULL)
        OR
        (status = 'REMOVED' AND removed_at IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_group_members_added_by'
      AND conrelid = 'groups.group_members'::regclass
  ) THEN
    ALTER TABLE groups.group_members
      ADD CONSTRAINT fk_group_members_added_by
      FOREIGN KEY (added_by)
      REFERENCES auth.users(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_group_members_removed_by'
      AND conrelid = 'groups.group_members'::regclass
  ) THEN
    ALTER TABLE groups.group_members
      ADD CONSTRAINT fk_group_members_removed_by
      FOREIGN KEY (removed_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_group_members_group_status
ON groups.group_members(group_id, status);

CREATE INDEX IF NOT EXISTS idx_group_members_user_status
ON groups.group_members(user_id, status);

ALTER TABLE groups.group_invitations
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;

UPDATE groups.group_invitations
SET responded_at = updated_at
WHERE status <> 'PENDING'
  AND responded_at IS NULL;

WITH ranked_pending_invitations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY group_id, invited_user_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM groups.group_invitations
  WHERE status = 'PENDING'
)
UPDATE groups.group_invitations invitation
SET
  status = 'CANCELLED',
  responded_at = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
FROM ranked_pending_invitations ranked
WHERE invitation.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_invitations_pending_user
ON groups.group_invitations(group_id, invited_user_id)
WHERE status = 'PENDING';

COMMIT;
