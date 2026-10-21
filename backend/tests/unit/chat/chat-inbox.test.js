import {jest} from '@jest/globals';
const query=jest.fn();
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{query}}));
const {ChatInboxService}=await import('../../../src/modules/chat/chat-inbox.service.js');
const service=new ChatInboxService();
const userId='11111111-1111-4111-8111-111111111111';
const row={id:'22222222-2222-4222-8222-222222222222',conversation_type:'group',request_status:'ACCEPTED',
  can_send:true,unread_count:2,is_muted:false,is_archived:false,cursor_time:'2026-10-16 07:15:29.600798',
  last_message:{id:'message',senderId:'sender',type:'TEXT',text:'hello',deleted:false,createdAt:'2026-10-16T07:15:29.600Z'}};
beforeEach(()=>query.mockReset());
test('inbox explicitly formats stored UTC last-message time with Z and milliseconds',async()=>{
  query.mockResolvedValue({rows:[row]});
  const result=await service.list(userId,{limit:5,archived:false});
  const [sql]=query.mock.calls[0];
  expect(sql).toContain("'createdAt',to_char(m.created_at,'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')");
  expect(result.conversations[0].lastMessage).toEqual(row.last_message);
  expect(result.conversations[0].unreadCount).toBe(2);
  expect(new Date(result.conversations[0].lastMessage.createdAt).toISOString()).toBe('2026-10-16T07:15:29.600Z');
});
test('timestamp presentation does not alter sorting or microsecond pagination cursor',async()=>{
  query.mockResolvedValue({rows:[row,{...row,id:'33333333-3333-4333-8333-333333333333'}]});
  const result=await service.list(userId,{limit:1,archived:false});
  const [sql,params]=query.mock.calls[0];
  expect(sql).toContain('ORDER BY COALESCE(latest.created_at,c.created_at) DESC,c.id DESC');
  expect(sql).toContain('COALESCE(latest.created_at,c.created_at)::text AS cursor_time');
  expect(JSON.parse(Buffer.from(result.pagination.nextCursor,'base64url').toString()).createdAt).toBe(row.cursor_time);
  expect(params).toEqual([userId,false,null,null,null,2]);
});
test('empty conversations retain lastMessage null',async()=>{
  query.mockResolvedValue({rows:[{...row,last_message:null}]});
  const result=await service.list(userId,{limit:5,archived:false});
  expect(result.conversations[0].lastMessage).toBeNull();
});
