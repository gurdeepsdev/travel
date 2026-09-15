import {jest} from '@jest/globals';
const client={query:jest.fn()},db={transaction:fn=>fn(client)};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
const {default:repository}=await import('../../../src/modules/itinerary/personal-itinerary.repository.js');
beforeEach(()=>jest.clearAllMocks());
test('inaccessible members cannot update state',async()=>{
  client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
  expect(await repository.updateStatus({itineraryId:'i',userId:'u',status:'UPCOMING'})).toBeNull();
  expect(client.query).toHaveBeenCalledTimes(2);
});
test.each([
  ['PLANNED','PLANNED',false],['UPCOMING','UPCOMING',false],
  ['PLANNED','COMPLETED',true],['COMPLETED','PLANNED',true],
])('personal transition %s to %s',async(current,status,invalid)=>{
  client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:'i',created_by:'owner'}]})
    .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{status:current}]})
    .mockResolvedValueOnce({rows:[{id:'t'}]});
  const result=await repository.updateStatus({itineraryId:'i',userId:'member',status});
  expect(result).toMatchObject(invalid?{invalid_transition:true,current_status:current}:{updated:false,current_status:status});
  expect(client.query).toHaveBeenCalledTimes(5);
});
test.each([['PLANNED','UPCOMING'],['UPCOMING','PLANNED'],['UPCOMING','LIVE'],['LIVE','COMPLETED']])(
  'writes only viewer state %s to %s',async(current,status)=>{
    client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:'i',created_by:'owner'}]})
      .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{status:current}]})
      .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:'t'}]})
      .mockResolvedValueOnce({rows:[{status}]});
    const result=await repository.updateStatus({itineraryId:'i',userId:'member',status});
    expect(result).toMatchObject({updated:true,current_status:status,previous_status:current,trip_id:'t'});
    expect(client.query.mock.calls[5][1]).toEqual(['i','owner']);
    expect(client.query.mock.calls[6][1]).toEqual(['i','member',status]);
  });
