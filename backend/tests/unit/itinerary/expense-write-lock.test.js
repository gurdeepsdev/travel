import {jest} from '@jest/globals';
import {lockExpenseParticipants} from '../../../src/modules/itinerary/expense-write-lock.js';

test('checks membership only after acquiring itinerary lock',async()=>{
  const client={query:jest.fn().mockResolvedValueOnce({rows:[{itinerary_id:'itinerary'}]})
    .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{user_id:'user'}]})};
  await lockExpenseParticipants(client,'trip',['user','user']);
  expect(client.query.mock.calls[1][0]).toContain('pg_advisory_xact_lock');
  expect(client.query.mock.calls[2][1]).toEqual(['trip',['user'],'itinerary']);
});
test('rejects participants removed while waiting for lock',async()=>{
  const client={query:jest.fn().mockResolvedValueOnce({rows:[{itinerary_id:'itinerary'}]})
    .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]})};
  await expect(lockExpenseParticipants(client,'trip',['user'])).rejects.toMatchObject({statusCode:422});
});
test('rejects missing trip',async()=>{
  const client={query:jest.fn().mockResolvedValue({rows:[]})};
  await expect(lockExpenseParticipants(client,'trip',['user'])).rejects.toMatchObject({statusCode:404});
});
