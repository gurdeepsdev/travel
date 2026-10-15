export async function publishRequestNotice(client, request, actorId) {
  const { rows: groups } = await client.query(`
    INSERT INTO chat.conversations(conversation_type,group_id,request_status)
    SELECT 'group',g.id,'ACCEPTED' FROM groups.groups g
    WHERE g.itinerary_id=$1 AND g.status='ACTIVE' AND g.deleted_at IS NULL
    ON CONFLICT(group_id) DO UPDATE SET group_id=EXCLUDED.group_id
    RETURNING id`, [request.itinerary_id]);
  if (!groups.length) return;
  const { rows: [profile] } = await client.query(`SELECT
    COALESCE(NULLIF(display_name,''),username,'A member') AS name
    FROM users.profiles WHERE user_id=$1 AND deleted_at IS NULL`, [actorId]);
  const actor = (profile?.name ?? 'A member').slice(0, 150);
  const text = request.status === 'PENDING' ? `${actor} requested itinerary changes.`
    : `${actor} ${request.status === 'ACCEPTED' ? 'accepted' : 'rejected'} an itinerary change request.`;
  for (const conversation of groups) {
    const { rows: [notice] } = await client.query(`INSERT INTO chat.chat_messages
      (conversation_id,sent_by,message_type,message_content,itinerary_id,change_request_id,change_request_status)
      VALUES($1,$2,'SYSTEM',$3,$4,$5,$6)
      ON CONFLICT(conversation_id,change_request_id,change_request_status)
        WHERE change_request_id IS NOT NULL DO NOTHING RETURNING id`,
    [conversation.id, actorId, text, request.itinerary_id, request.id, request.status]);
    if (!notice) continue;
    await client.query(`UPDATE chat.conversations SET last_message_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [conversation.id, notice.id]);
    await client.query(`INSERT INTO chat.event_outbox(conversation_id,message_id,event_type) VALUES($1,$2,'message.created')`, [conversation.id, notice.id]);
  }
}
