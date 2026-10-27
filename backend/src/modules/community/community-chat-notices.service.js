export async function publishCommunityNotice(client, { communityId, actorId, memberId = actorId, type, automatic = false, communityName, previousName, imageAssetId }) {
  const { rows: [conversation] } = await client.query(
    'SELECT id FROM chat.conversations WHERE community_id=$1 AND deleted_at IS NULL', [communityId]);
  if (!conversation) throw new Error('Community conversation is unavailable.');
  const { rows: profiles } = await client.query(`SELECT user_id,
    COALESCE(NULLIF(display_name,''),username,'A member') AS name
    FROM users.profiles WHERE user_id=ANY($1::uuid[]) AND deleted_at IS NULL`, [[actorId, memberId]]);
  const name = id => (profiles.find(p => p.user_id === id)?.name ?? 'A member').slice(0, 150);
  const actor = name(actorId), member = name(memberId);
  const text = type === 'COMMUNITY_NAME_CHANGED' ? `${actor} changed the community name to “${communityName}”.`
    : type === 'COMMUNITY_IMAGE_CHANGED' ? `${actor} changed the community photo.`
    : type === 'ADMIN_PROMOTED' ? (automatic ? `${member} became an admin.` : `${actor} made ${member} an admin.`)
    : type === 'ADMIN_DEMOTED' ? `${actor} removed admin access from ${member}.`
    : type === 'ADMIN_LEFT' ? `${member} left the community.`
    : `${actor} removed ${member} from the community.`;
  const payload = { type, communityId, actorId, memberId, automatic,
    ...(communityName !== undefined ? { communityName, previousName } : {}),
    ...(imageAssetId ? { imageAssetId } : {}) };
  const { rows: [notice] } = await client.query(`INSERT INTO chat.chat_messages
    (conversation_id,sent_by,message_type,message_content,group_event)
    VALUES($1,$2,'SYSTEM',$3,$4::jsonb) RETURNING id`, [conversation.id, actorId, text, JSON.stringify(payload)]);
  await client.query('UPDATE chat.conversations SET last_message_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [conversation.id, notice.id]);
  await client.query("INSERT INTO chat.event_outbox(conversation_id,message_id,event_type) VALUES($1,$2,'message.created')", [conversation.id, notice.id]);
}
