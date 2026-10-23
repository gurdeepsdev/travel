BEGIN;
LOCK TABLE community.communities,community.community_members IN ACCESS EXCLUSIVE MODE;
ALTER TABLE community.community_member_request ALTER COLUMN reviewed_by DROP NOT NULL;
INSERT INTO community.community_members(community_id,user_id,role,status)
SELECT id,owner_id,'ADMIN','ACTIVE' FROM community.communities WHERE deleted_at IS NULL
ON CONFLICT(community_id,user_id) DO NOTHING;
UPDATE community.community_members SET role=CASE WHEN lower(role) IN ('owner','admin') THEN 'ADMIN' ELSE 'MEMBER' END,
  status=upper(status);
UPDATE community.communities SET join_type=CASE WHEN upper(join_type) IN ('OPEN','PUBLIC') THEN 'OPEN' ELSE 'APPROVAL' END;
UPDATE community.community_members m SET status='REMOVED' WHERE EXISTS(
  SELECT 1 FROM community.community_bans b WHERE b.community_id=m.community_id AND b.banned_user_id=m.user_id);
WITH candidates AS (
  SELECT m.id,ROW_NUMBER() OVER(PARTITION BY m.community_id ORDER BY m.created_at,m.id) AS position
  FROM community.community_members m JOIN community.communities c ON c.id=m.community_id AND c.deleted_at IS NULL
  WHERE m.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM community.community_members a WHERE a.community_id=m.community_id AND a.status='ACTIVE' AND a.role='ADMIN')
) UPDATE community.community_members m SET role='ADMIN' FROM candidates WHERE m.id=candidates.id AND candidates.position=1;
UPDATE community.communities c SET member_count=(SELECT COUNT(*) FROM community.community_members m WHERE m.community_id=c.id AND m.status='ACTIVE');
CREATE INDEX IF NOT EXISTS idx_community_management_listing ON community.communities(created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_pending_join ON community.community_member_request(community_id,request_by)
  WHERE request_type='JOIN' AND status='PENDING';
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
    AND cm.deleted_at IS NULL AND EXISTS(SELECT 1 FROM community.community_members m
      WHERE m.community_id=cm.id AND m.user_id=viewer AND upper(m.status)='ACTIVE')
    AND NOT EXISTS(SELECT 1 FROM community.community_bans b WHERE b.community_id=cm.id AND b.banned_user_id=viewer)))
 );
$$;
COMMIT;
