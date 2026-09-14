import { jest } from '@jest/globals';
const repository={list:jest.fn()}, profiles={findByUsername:jest.fn()};
jest.unstable_mockModule('../../../src/modules/users/repositories/tagged-posts.repository.js',()=>({default:repository}));
jest.unstable_mockModule('../../../src/modules/users/repositories/profiles.repository.js',()=>({default:profiles}));
const {default:service}=await import('../../../src/modules/users/services/tagged-posts.service.js');
const {encodeCursor,decodeCursor}=await import('../../../src/shared/utils/cursor.js');
const {getMyPostsSchema,getUserPostsSchema}=await import('../../../src/modules/users/validations/user-posts.validation.js');
const viewer='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
beforeEach(()=>{
  jest.clearAllMocks();
  repository.list.mockResolvedValue({posts:[],hasMore:false,nextCursor:null});
});
test('own endpoint always uses authenticated user as tag target',async()=>{
  expect(await service.list({viewerUserId:viewer})).toEqual({posts:[],pagination:{hasMore:false,nextCursor:null}});
  expect(repository.list).toHaveBeenCalledWith({targetUserId:viewer,viewerUserId:viewer,limit:20,cursor:null});
  expect(profiles.findByUsername).not.toHaveBeenCalled();
});
test.each([null,viewer])('named endpoint resolves target independently of viewer %s',async viewerUserId=>{
  profiles.findByUsername.mockResolvedValue({user_id:target});
  await service.list({username:'target',viewerUserId});
  expect(repository.list).toHaveBeenCalledWith({targetUserId:target,viewerUserId,limit:20,cursor:null});
});
test('missing profile is 404',async()=>{
  profiles.findByUsername.mockResolvedValue(null);
  await expect(service.list({username:'missing'})).rejects.toMatchObject({statusCode:404});
  expect(repository.list).not.toHaveBeenCalled();
});
test('preserves microsecond cursor precision',async()=>{
  const cursor={id:target,createdAt:'2026-01-01 00:00:00.123456'};
  repository.list.mockResolvedValue({posts:[{id:target}],hasMore:true,nextCursor:cursor});
  const result=await service.list({viewerUserId:viewer,limit:1,cursor:encodeCursor(cursor)});
  expect(repository.list).toHaveBeenCalledWith({targetUserId:viewer,viewerUserId:viewer,limit:1,cursor});
  expect(decodeCursor(result.pagination.nextCursor)).toEqual(cursor);
});
test('malformed cursor fails before querying',async()=>{
  await expect(service.list({viewerUserId:viewer,cursor:'bad'})).rejects.toMatchObject({statusCode:400});
  expect(repository.list).not.toHaveBeenCalled();
});
test.each([0,51,1.5,'bad'])('rejects invalid limit %s',limit=>{
  expect(getMyPostsSchema.safeParse({params:{},query:{limit}}).success).toBe(false);
});
test('named route retains existing username validation',()=>{
  expect(getUserPostsSchema.safeParse({params:{username:'a'},query:{}}).success).toBe(false);
});
