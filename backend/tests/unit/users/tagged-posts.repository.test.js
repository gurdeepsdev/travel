import { jest } from '@jest/globals';
const db={query:jest.fn()}, posts={getPostsByIds:jest.fn()};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
jest.unstable_mockModule('../../../src/modules/users/repositories/posts.repository.js',()=>({default:posts}));
const {default:repository}=await import('../../../src/modules/users/repositories/tagged-posts.repository.js');
const target='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222';
beforeEach(()=>jest.clearAllMocks());
test('empty authorized page skips hydration',async()=>{
  db.query.mockResolvedValue({rows:[]});
  expect(await repository.list({targetUserId:target,viewerUserId:null,limit:20,cursor:null}))
    .toEqual({posts:[],hasMore:false,nextCursor:null});
  expect(posts.getPostsByIds).not.toHaveBeenCalled();
  expect(db.query.mock.calls[0][1]).toEqual([target,null,null,null,21]);
});
test('hydrates only requested page and uses raw timestamp cursor',async()=>{
  const createdAt='2026-01-01 00:00:00.123456';
  db.query.mockResolvedValue({rows:[{id:target,cursor_created_at:createdAt},{id:viewer,cursor_created_at:createdAt}]});
  posts.getPostsByIds.mockResolvedValue([{id:target,assets:[]}]);
  const result=await repository.list({targetUserId:target,viewerUserId:viewer,limit:1,cursor:{id:viewer,createdAt}});
  expect(posts.getPostsByIds).toHaveBeenCalledWith({postIds:[target],viewerUserId:viewer});
  expect(result).toEqual({posts:[{id:target,assets:[]}],hasMore:true,nextCursor:{id:target,createdAt}});
  expect(db.query.mock.calls[0][1]).toEqual([target,viewer,createdAt,viewer,2]);
});
