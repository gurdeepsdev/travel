export async function publishGroupNotice(client, { groupId, actorId, memberId, type, automatic = false }) {
  const { rows: [conversation] } = await client.query(`
    INSERT INTO chat.conversations(conversation_type,group_id,request_status)
    VALUES('group',$1,'ACCEPTED')
    ON CONFLICT(group_id) DO UPDATE SET group_id=EXCLUDED.group_id RETURNING id`, [groupId]);
  const { rows: profiles } = await client.query(`SELECT user_id,
    COALESCE(NULLIF(display_name,''),username,'A member') AS name
    FROM users.profiles WHERE user_id=ANY($1::uuid[]) AND deleted_at IS NULL`, [[actorId, memberId]]);
  const name = id => (profiles.find(p => p.user_id === id)?.name ?? 'A member').slice(0, 150);
  const actor = name(actorId), member = name(memberId);
  const text = type === 'ADMIN_PROMOTED' ? (automatic ? `${member} became an admin.` : `${actor} made ${member} an admin.`)
    : type === 'ADMIN_DEMOTED' ? `${actor} removed admin access from ${member}.`
    : type === 'MEMBER_REMOVED' ? `${actor} removed ${member} from the group.`
    : type === 'MEMBER_JOINED' ? `${member} joined the group.`
    : `${member} left the group.`;
  const groupEvent = { type, groupId, actorId, memberId, automatic };
  const { rows: [notice] } = await client.query(`INSERT INTO chat.chat_messages
    (conversation_id,sent_by,message_type,message_content,group_event)
    VALUES($1,$2,'SYSTEM',$3,$4::jsonb) RETURNING id`, [conversation.id, actorId, text, JSON.stringify(groupEvent)]);
  await client.query('UPDATE chat.conversations SET last_message_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [conversation.id, notice.id]);
  await client.query("INSERT INTO chat.event_outbox(conversation_id,message_id,event_type) VALUES($1,$2,'message.created')", [conversation.id, notice.id]);
}
