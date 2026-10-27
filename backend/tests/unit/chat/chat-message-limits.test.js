import { validateMessageLimits } from '../../../src/modules/chat/chat-message-limits.js';
import { sendMessageSchema, editMessageSchema } from '../../../src/modules/chat/chat.validation.js';
const conversationId='11111111-1111-4111-8111-111111111111';
const clientMessageId='22222222-2222-4222-8222-222222222222';
test('community accepts 4096 characters but rejects 4097',()=>{
  expect(()=>validateMessageLimits({conversation_type:'community'},{text:'x'.repeat(4096)})).not.toThrow();
  expect(()=>validateMessageLimits({conversation_type:'community'},{text:'x'.repeat(4097)})).toThrow('4096 characters');
});
test.each(['direct','group'])('%s retains 512 characters and ten attachments',type=>{
  expect(()=>validateMessageLimits({conversation_type:type},{text:'x'.repeat(512),assetIds:Array(10)})).not.toThrow();
  expect(()=>validateMessageLimits({conversation_type:type},{text:'x'.repeat(513)})).toThrow('512 characters');
});
test('community permits attachment-only messages with five IDs but rejects six',()=>{
  expect(()=>validateMessageLimits({conversation_type:'community'},{assetIds:Array(5)})).not.toThrow();
  expect(()=>validateMessageLimits({conversation_type:'community'},{assetIds:Array(6)})).toThrow('5 attachments');
});
test.each([sendMessageSchema,editMessageSchema])('send/edit schema admits community boundary and rejects overflow',schema=>{
  const params={conversationId,messageId:clientMessageId};
  const body=schema===sendMessageSchema?{clientMessageId}:{};
  const input={params:schema===sendMessageSchema?{conversationId}:params,query:{},body:{...body,text:'x'.repeat(4096)}};
  expect(schema.safeParse(input).success).toBe(true);
  input.body.text+='x';expect(schema.safeParse(input).success).toBe(false);
});
