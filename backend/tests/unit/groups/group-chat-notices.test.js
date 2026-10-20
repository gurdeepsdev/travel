import {jest} from '@jest/globals';
import {publishGroupNotice} from '../../../src/modules/groups/group-chat-notices.service.js';
test.each([
  ['GROUP_CREATED',{},'Manav created the group.'],
  ['GROUP_NAME_CHANGED',{groupName:'Delhi Trip',previousName:'Old group'},'Manav changed the group name to “Delhi Trip”.'],
  ['GROUP_IMAGE_CHANGED',{imageAssetId:'image'},'Manav changed the group photo.'],
  ['ITINERARY_UNLINKED',{itineraryId:'itinerary'},'Manav unlinked the itinerary from the group.'],
])('%s persists the expected notice and outbox event',async(type,extra,text)=>{
  const client={query:jest.fn().mockResolvedValueOnce({rows:[{id:'conversation'}]})
    .mockResolvedValueOnce({rows:[{user_id:'actor',name:'Manav'}]})
    .mockResolvedValueOnce({rows:[{id:'notice'}]}).mockResolvedValue({rows:[]})};
  await publishGroupNotice(client,{groupId:'group',actorId:'actor',type,...extra});
  const params=client.query.mock.calls[2][1];
  expect(params[2]).toBe(text);
  expect(JSON.parse(params[3])).toMatchObject({type,groupId:'group',actorId:'actor',...extra});
  expect(client.query.mock.calls[4][1]).toEqual(['conversation','notice']);
  expect(client.query.mock.calls[4][0]).toContain("'message.created'");
});
test('notice persistence errors propagate to the caller transaction',async()=>{
  const client={query:jest.fn().mockResolvedValueOnce({rows:[{id:'conversation'}]})
    .mockResolvedValueOnce({rows:[]}).mockRejectedValueOnce(new Error('write failed'))};
  await expect(publishGroupNotice(client,{groupId:'group',actorId:'actor',type:'GROUP_CREATED'})).rejects.toThrow('write failed');
  expect(client.query).toHaveBeenCalledTimes(3);
});
