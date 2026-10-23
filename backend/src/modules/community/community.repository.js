import Database from '../../database/database-manager.js';
import AppError from '../../core/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../shared/utils/cursor.js';

const fail = (code, message, statusCode = 404) => { throw new AppError({ code: `COMMUNITY.${code}`, message, statusCode }); };
const one = async (client, sql, params = []) => (await client.query(sql, params)).rows[0];
const map = row => ({ id: row.id, ownerId: row.owner_id, name: row.name, description: row.description,
  joinType: row.join_type, memberCount: Number(row.member_count), viewerRole: row.viewer_role ?? null,
  conversationId: row.conversation_id ?? null,
  image: row.icon_asset_id ? { id: row.icon_asset_id, url: `/api/v1/media/assets/${row.icon_asset_id}/content`, mimeType: row.icon_mime_type ?? null } : null,
  createdAt: row.created_at, updatedAt: row.updated_at });
const pageResult = (rows, limit, mapper = value => value) => {
  const page = rows.slice(0, limit), last = page.at(-1);
  return { items: page.map(mapper), pagination: { hasMore: rows.length > limit,
    nextCursor: rows.length > limit ? encodeCursor({ createdAt: last.cursor_time, id: last.id }) : null } };
};
async function access(client, id, userId, admin = false, requireMember = false) {
  const community = await one(client, `SELECT c.*,m.role AS viewer_role FROM community.communities c
    LEFT JOIN community.community_members m ON m.community_id=c.id AND m.user_id=$2 AND upper(m.status)='ACTIVE'
    WHERE c.id=$1 AND c.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM community.community_bans b WHERE b.community_id=c.id AND b.banned_user_id=$2)
    FOR UPDATE OF c`, [id, userId]);
  if (!community || ((admin || requireMember) && !community.viewer_role) || (admin && community.viewer_role.toUpperCase() !== 'ADMIN'))
    fail('NOT_FOUND', 'Community is unavailable.');
  return community;
}
async function icon(client, assetId, userId) {
  if (!await one(client, `SELECT id FROM media.assets WHERE id=$1 AND uploaded_by=$2 AND is_public IS TRUE
    AND deleted_at IS NULL AND processing_status='READY' AND mime_type IN ('image/jpeg','image/png','image/webp','image/heic','image/heif') FOR SHARE`, [assetId, userId]))
    fail('IMAGE_NOT_ALLOWED', 'Select an available image uploaded by this user.', 422);
}
async function recount(client, id) {
  await client.query(`UPDATE community.communities SET member_count=(SELECT COUNT(*) FROM community.community_members
    WHERE community_id=$1 AND upper(status)='ACTIVE'),updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id]);
}
async function event(client, id) {
  await client.query(`INSERT INTO chat.event_outbox(conversation_id,event_type)
    SELECT id,'conversation.updated' FROM chat.conversations WHERE community_id=$1 AND deleted_at IS NULL`, [id]);
}
async function activate(client, id, userId) {
  if (!await one(client, "SELECT id FROM auth.users WHERE id=$1 AND status='ACTIVE'", [userId])) fail('MEMBER_NOT_FOUND', 'Active user is unavailable.');
  await client.query(`INSERT INTO community.community_members(community_id,user_id,role,status) VALUES($1,$2,'MEMBER','ACTIVE')
    ON CONFLICT(community_id,user_id) DO UPDATE SET status='ACTIVE',role=CASE WHEN upper(community.community_members.status)='ACTIVE'
    THEN community.community_members.role ELSE 'MEMBER' END,updated_at=CURRENT_TIMESTAMP`, [id, userId]);
  await recount(client, id);
}
async function succession(client, id) {
  if (!await one(client, "SELECT id FROM community.community_members WHERE community_id=$1 AND upper(status)='ACTIVE' AND upper(role)='ADMIN'", [id])) {
    await client.query(`UPDATE community.community_members SET role='ADMIN',updated_at=CURRENT_TIMESTAMP WHERE id=(
      SELECT id FROM community.community_members WHERE community_id=$1 AND upper(status)='ACTIVE' ORDER BY created_at,id LIMIT 1)`, [id]);
  }
  await recount(client, id);
  await client.query(`UPDATE community.communities SET deleted_at=CURRENT_TIMESTAMP WHERE id=$1 AND member_count=0`, [id]);
  await client.query(`UPDATE community.community_member_request SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP
    WHERE community_id=$1 AND status='PENDING' AND EXISTS(SELECT 1 FROM community.communities WHERE id=$1 AND deleted_at IS NOT NULL)`, [id]);
}
class CommunityRepository {
  async list(userId, { limit, cursor, search }, mine = false) {
    const position = decodeCursor(cursor);
    const { rows } = await Database.query(`SELECT c.*,c.created_at::text AS cursor_time,m.role AS viewer_role,
      a.mime_type AS icon_mime_type,v.id AS conversation_id FROM community.communities c
      LEFT JOIN community.community_members m ON m.community_id=c.id AND m.user_id=$1 AND upper(m.status)='ACTIVE'
      LEFT JOIN media.assets a ON a.id=c.icon_asset_id AND a.deleted_at IS NULL
      LEFT JOIN chat.conversations v ON v.community_id=c.id AND v.deleted_at IS NULL AND m.id IS NOT NULL
      WHERE c.deleted_at IS NULL AND ($2::boolean IS FALSE OR m.id IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM community.community_bans b WHERE b.community_id=c.id AND b.banned_user_id=$1)
      AND ($3::text IS NULL OR c.name ILIKE '%'||$3||'%')
      AND ($4::timestamp IS NULL OR (c.created_at,c.id)<($4::timestamp,$5::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT $6`,
    [userId, mine, search ?? null, position?.createdAt ?? null, position?.id ?? null, limit + 1]);
    const result = pageResult(rows, limit, map); return { communities: result.items, pagination: result.pagination };
  }
  async get(userId, id) {
    return Database.transaction(async client => {
      await access(client, id, userId);
      const row = await one(client, `SELECT c.*,m.role AS viewer_role,a.mime_type AS icon_mime_type,v.id AS conversation_id
        FROM community.communities c LEFT JOIN community.community_members m ON m.community_id=c.id AND m.user_id=$2 AND upper(m.status)='ACTIVE'
        LEFT JOIN media.assets a ON a.id=c.icon_asset_id AND a.deleted_at IS NULL
        LEFT JOIN chat.conversations v ON v.community_id=c.id AND v.deleted_at IS NULL AND m.id IS NOT NULL WHERE c.id=$1`, [id, userId]);
      return { community: map(row) };
    });
  }
  async create(userId, input) {
    const id = await Database.transaction(async client => {
      await icon(client, input.iconAssetId, userId);
      const row = await one(client, `INSERT INTO community.communities(owner_id,name,description,icon_asset_id,join_type,member_count)
        VALUES($1,$2,$3,$4,$5,1) RETURNING id`, [userId, input.name, input.description ?? null, input.iconAssetId, input.joinType]);
      await client.query("INSERT INTO community.community_members(community_id,user_id,role,status) VALUES($1,$2,'ADMIN','ACTIVE')", [row.id, userId]);
      await client.query("INSERT INTO chat.conversations(conversation_type,community_id,request_status) VALUES('community',$1,'ACCEPTED')", [row.id]);
      return row.id;
    });
    return this.get(userId, id);
  }
  async update(userId, id, input) {
    await Database.transaction(async client => {
      const current = await access(client, id, userId, true);
      if (input.iconAssetId) await icon(client, input.iconAssetId, userId);
      await client.query(`UPDATE community.communities SET name=$2,description=$3,icon_asset_id=$4,join_type=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [id, input.name ?? current.name, Object.hasOwn(input,'description') ? input.description : current.description, input.iconAssetId ?? current.icon_asset_id, input.joinType ?? current.join_type]);
      await event(client, id);
    });
    return this.get(userId, id);
  }
  async remove(userId, id) {
    return Database.transaction(async client => {
      await access(client, id, userId, true);
      await client.query('UPDATE community.communities SET deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id]);
      await client.query("UPDATE community.community_member_request SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE community_id=$1 AND status='PENDING'", [id]);
      return { communityId: id, deleted: true };
    });
  }
  async join(userId, id) {
    return Database.transaction(async client => {
      const current = await access(client, id, userId);
      if (current.viewer_role) return { communityId: id, status: 'ACTIVE', updated: false };
      if (current.join_type === 'OPEN') {
        await activate(client, id, userId);
        await client.query("UPDATE community.community_member_request SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE community_id=$1 AND request_by=$2 AND request_type='JOIN' AND status='PENDING'", [id,userId]);
        await event(client, id);
        return { communityId: id, status: 'ACTIVE', updated: true };
      }
      if (current.join_type !== 'APPROVAL') fail('JOIN_UNAVAILABLE', 'Community joining is unavailable.', 409);
      const admin = await one(client, "SELECT user_id FROM community.community_members WHERE community_id=$1 AND upper(status)='ACTIVE' AND upper(role)='ADMIN' ORDER BY created_at,id LIMIT 1", [id]);
      if (!admin) fail('JOIN_UNAVAILABLE', 'Community joining is unavailable.', 409);
      const existing = await one(client, "SELECT * FROM community.community_member_request WHERE community_id=$1 AND request_by=$2 AND request_type='JOIN' AND status='PENDING'", [id, userId]);
      const row = existing ?? await one(client, `INSERT INTO community.community_member_request(community_id,request_type,request_by,target_user_id,status,reviewed_by)
        VALUES($1,'JOIN',$2,$3,'PENDING',NULL) RETURNING *`, [id, userId, admin.user_id]);
      if (!existing) await event(client, id);
      return { communityId: id, status: 'PENDING', requestId: row.id, updated: !existing };
    });
  }
  async members(userId, id, { limit, cursor }, bans = false) {
    return Database.transaction(async client => {
      await access(client, id, userId, bans, !bans);
      const position = decodeCursor(cursor);
      const { rows } = await client.query(bans ? `SELECT b.id,b.created_at::text AS cursor_time,b.banned_user_id AS user_id,b.reason,p.username,p.display_name
        FROM community.community_bans b LEFT JOIN users.profiles p ON p.user_id=b.banned_user_id AND p.deleted_at IS NULL
        WHERE b.community_id=$1 AND ($2::timestamp IS NULL OR (b.created_at,b.id)<($2::timestamp,$3::uuid)) ORDER BY b.created_at DESC,b.id DESC LIMIT $4`
        : `SELECT m.id,m.created_at::text AS cursor_time,m.user_id,m.role,p.username,p.display_name,a.id AS photo_id,a.mime_type
        FROM community.community_members m LEFT JOIN users.profiles p ON p.user_id=m.user_id AND p.deleted_at IS NULL
        LEFT JOIN media.assets a ON a.id=p.profile_photo_asset_id AND a.deleted_at IS NULL
        WHERE m.community_id=$1 AND upper(m.status)='ACTIVE' AND ($2::timestamp IS NULL OR (m.created_at,m.id)<($2::timestamp,$3::uuid))
        ORDER BY m.created_at DESC,m.id DESC LIMIT $4`, [id, position?.createdAt ?? null, position?.id ?? null, limit + 1]);
      const result = pageResult(rows, limit, row => ({ id: row.id, user: { id: row.user_id, username: row.username ?? null, displayName: row.display_name ?? null,
        profilePhoto: row.photo_id ? { id: row.photo_id, url: `/api/v1/media/assets/${row.photo_id}/content`, mimeType: row.mime_type } : null },
        ...(bans ? { reason: row.reason } : { role: row.role?.toUpperCase(), status: 'ACTIVE' }) }));
      return { [bans ? 'bans' : 'members']: result.items, pagination: result.pagination };
    });
  }
  async memberAction(userId, id, target, action, input = {}) {
    return Database.transaction(async client => {
      await access(client, id, userId, action !== 'leave', action === 'leave');
      if (action === 'unban') {
        const result = await client.query('DELETE FROM community.community_bans WHERE community_id=$1 AND banned_user_id=$2', [id, target]);
        return { communityId: id, userId: target, updated: result.rowCount > 0 };
      }
      if (action === 'ban' && userId === target) fail('SELF_BAN', 'An admin cannot ban themselves.', 409);
      const member = await one(client, "SELECT * FROM community.community_members WHERE community_id=$1 AND user_id=$2 AND upper(status)='ACTIVE'", [id, target]);
      if (!member && action !== 'ban') fail('MEMBER_NOT_FOUND', 'Active community member not found.');
      if (action === 'role') {
        if (member.role.toUpperCase() === 'ADMIN' && input.role === 'MEMBER' && !await one(client, "SELECT id FROM community.community_members WHERE community_id=$1 AND user_id<>$2 AND upper(role)='ADMIN' AND upper(status)='ACTIVE'", [id, target]))
          fail('LAST_ADMIN_REQUIRED', 'Promote another member before demoting the last admin.', 409);
        if (member.role.toUpperCase() !== input.role) {
          await client.query('UPDATE community.community_members SET role=$3,updated_at=CURRENT_TIMESTAMP WHERE community_id=$1 AND user_id=$2', [id, target, input.role]);
          await event(client, id);
        }
        return { communityId: id, userId: target, role: input.role };
      }
      if (action === 'ban') {
        if (!await one(client, "SELECT id FROM auth.users WHERE id=$1 AND status='ACTIVE'", [target])) fail('MEMBER_NOT_FOUND', 'Active user not found.');
        await client.query(`INSERT INTO community.community_bans(community_id,user_id,banned_user_id,reason) VALUES($1,$2,$3,$4)
          ON CONFLICT(community_id,banned_user_id) DO NOTHING`, [id, userId, target, input.reason ?? null]);
      }
      if (member) await client.query("UPDATE community.community_members SET status='REMOVED',updated_at=CURRENT_TIMESTAMP WHERE community_id=$1 AND user_id=$2", [id, target]);
      await client.query("UPDATE community.community_member_request SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE community_id=$1 AND request_by=$2 AND status='PENDING'", [id, target]);
      await succession(client, id); await event(client, id);
      return { communityId: id, userId: target, status: action === 'ban' ? 'BANNED' : 'REMOVED' };
    });
  }
  async requests(userId, id, { limit, cursor, status }) {
    return Database.transaction(async client => {
      await access(client, id, userId, true);
      const position = decodeCursor(cursor);
      const { rows } = await client.query(`SELECT r.id,r.request_by AS "userId",r.status,r.created_at::text AS cursor_time,p.username,p.display_name AS "displayName"
        FROM community.community_member_request r LEFT JOIN users.profiles p ON p.user_id=r.request_by AND p.deleted_at IS NULL
        WHERE r.community_id=$1 AND r.request_type='JOIN' AND r.status=$2
        AND ($3::timestamp IS NULL OR (r.created_at,r.id)<($3::timestamp,$4::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT $5`, [id, status, position?.createdAt ?? null, position?.id ?? null, limit + 1]);
      const result = pageResult(rows, limit, ({ cursor_time, ...row }) => row);
      return { requests: result.items, pagination: result.pagination };
    });
  }
  async review(userId, id, requestId, status, cancel = false) {
    return Database.transaction(async client => {
      await access(client, id, userId, !cancel);
      const row = await one(client, "SELECT * FROM community.community_member_request WHERE id=$1 AND community_id=$2 AND request_type='JOIN' FOR UPDATE", [requestId, id]);
      if (!row || (cancel && row.request_by !== userId)) fail('REQUEST_NOT_FOUND', 'Join request unavailable.');
      if (row.status === status) return { requestId, status, updated: false };
      if (row.status !== 'PENDING') fail('REQUEST_RESOLVED', 'Join request already resolved.', 409);
      if (status === 'ACCEPTED') {
        if (await one(client, 'SELECT id FROM community.community_bans WHERE community_id=$1 AND banned_user_id=$2', [id, row.request_by])) fail('MEMBER_BANNED', 'Requested member is banned.', 409);
        await activate(client, id, row.request_by);
      }
      await client.query(`UPDATE community.community_member_request SET status=$2,reviewed_by=$3,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [requestId, status, cancel ? null : userId]);
      await event(client, id);
      return { requestId, status, updated: true };
    });
  }
}
export default new CommunityRepository();
