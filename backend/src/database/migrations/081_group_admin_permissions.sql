BEGIN;

LOCK TABLE groups.groups, groups.group_members IN ACCESS EXCLUSIVE MODE;

-- Backfill legacy creator memberships without restoring creators who already left.
INSERT INTO groups.group_members(group_id,user_id,role,status,added_by)
SELECT id,owner_id,'ADMIN','ACTIVE',owner_id FROM groups.groups
WHERE status='ACTIVE' AND deleted_at IS NULL
ON CONFLICT(group_id,user_id) DO NOTHING;

UPDATE groups.group_members SET role='ADMIN' WHERE role='OWNER';

WITH candidates AS (
  SELECT member.id,ROW_NUMBER() OVER(PARTITION BY member.group_id ORDER BY member.joined_at,member.id) AS position
  FROM groups.group_members member
  JOIN groups.groups g ON g.id=member.group_id AND g.status='ACTIVE' AND g.deleted_at IS NULL
  WHERE member.status='ACTIVE' AND NOT EXISTS(
    SELECT 1 FROM groups.group_members admin
    WHERE admin.group_id=member.group_id AND admin.status='ACTIVE' AND admin.role='ADMIN')
)
UPDATE groups.group_members member SET role='ADMIN',updated_at=CURRENT_TIMESTAMP
FROM candidates WHERE member.id=candidates.id AND candidates.position=1;

ALTER TABLE groups.group_members DROP CONSTRAINT IF EXISTS chk_group_member_role;
ALTER TABLE groups.group_members ADD CONSTRAINT chk_group_member_role CHECK(role IN ('ADMIN','MEMBER'));

CREATE OR REPLACE FUNCTION chat.accessible_conversations(viewer UUID)
RETURNS SETOF chat.conversations LANGUAGE SQL STABLE AS $$
 SELECT c.* FROM chat.conversations c WHERE c.deleted_at IS NULL AND (
  (c.conversation_type='direct' AND EXISTS (SELECT 1 FROM chat.conversation_participants p
    WHERE p.conversation_id=c.id AND p.user_id=viewer AND p.left_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM chat.conversation_participants p JOIN users.blocked_users b
     ON (b.user_id=viewer AND b.blocked_user_id=p.user_id) OR (b.blocked_user_id=viewer AND b.user_id=p.user_id)
     WHERE p.conversation_id=c.id AND p.user_id<>viewer))
  OR (c.conversation_type='group' AND EXISTS(SELECT 1 FROM groups.groups g WHERE g.id=c.group_id
    AND g.status='ACTIVE' AND g.deleted_at IS NULL AND EXISTS(
      SELECT 1 FROM groups.group_members m WHERE m.group_id=g.id AND m.user_id=viewer AND m.status='ACTIVE')))
  OR (c.conversation_type='community' AND EXISTS(SELECT 1 FROM community.communities cm WHERE cm.id=c.community_id
    AND cm.deleted_at IS NULL AND (cm.owner_id=viewer OR EXISTS(SELECT 1 FROM community.community_members m
      WHERE m.community_id=cm.id AND m.user_id=viewer AND upper(m.status)='ACTIVE'))
    AND NOT EXISTS(SELECT 1 FROM community.community_bans b WHERE b.community_id=cm.id AND b.banned_user_id=viewer)))
 );
$$;

COMMIT;
