BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_pending_invitation
ON community.community_member_request(community_id, target_user_id)
WHERE request_type = 'INVITE' AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_community_received_invitations
ON community.community_member_request(target_user_id, status, created_at DESC, id DESC)
WHERE request_type = 'INVITE';

COMMIT;
