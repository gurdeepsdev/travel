import * as V from '../../../src/modules/community/community.validation.js';
const id='11111111-1111-4111-8111-111111111111';
const input=body=>({params:{},query:{},body});
test('community creation supports both join modes and requires an image',()=>{
  for(const joinType of ['OPEN','APPROVAL']) expect(V.creation.safeParse(input({name:'Delhi',iconAssetId:id,joinType})).success).toBe(true);
  for(const body of [{name:'Delhi'}, {name:'',iconAssetId:id}, {name:'Delhi',iconAssetId:id,ownerId:id}, {name:'Delhi',iconAssetId:id,joinType:'private'}])
    expect(V.creation.safeParse(input(body)).success).toBe(false);
});
test('partial update does not reset an existing join mode',()=>{
  expect(V.editing.parse({params:{communityId:id},query:{},body:{name:'Updated'}}).body).toEqual({name:'Updated'});
  expect(V.editing.safeParse({params:{communityId:id},query:{},body:{}}).success).toBe(false);
});
test('role and join review accept only supported changes',()=>{
  for(const role of ['ADMIN','MEMBER']) expect(V.role.safeParse({params:{communityId:id,userId:id},query:{},body:{role}}).success).toBe(true);
  expect(V.role.safeParse({params:{communityId:id,userId:id},query:{},body:{role:'OWNER'}}).success).toBe(false);
  expect(V.review.safeParse({params:{communityId:id,requestId:id},query:{},body:{status:'ACCEPTED'}}).success).toBe(true);
});
test('pagination bounds and UUIDs are validated',()=>{
  expect(V.listing.safeParse(input(undefined)).success).toBe(true);
  expect(V.listing.safeParse({params:{},query:{limit:1000}}).success).toBe(false);
  expect(V.resource.safeParse({params:{communityId:'invalid'},query:{}}).success).toBe(false);
});
