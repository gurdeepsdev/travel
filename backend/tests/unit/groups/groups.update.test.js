import { jest } from '@jest/globals';
import { updateGroupSchema } from '../../../src/modules/groups/groups.validation.js';
const update=jest.fn(),store=jest.fn(),remove=jest.fn(),inspect=jest.fn();
jest.unstable_mockModule('../../../src/modules/groups/groups.repository.js',()=>({default:{updateGroup:update}}));
jest.unstable_mockModule('../../../src/providers/storage/storage-manager.js',()=>({default:{store,remove}}));
jest.unstable_mockModule('../../../src/modules/users/utils/profile-photo-file.util.js',()=>({inspectProfilePhotoFile:inspect}));
const {default:service}=await import('../../../src/modules/groups/groups.service.js');
const id='11111111-1111-4111-8111-111111111111';
beforeEach(()=>jest.resetAllMocks());
test('each text field is optional; description may be cleared',()=>{
  const parse=body=>updateGroupSchema.parse({params:{groupId:id},query:{},body}).body;
  expect(parse({name:' New name '})).toEqual({name:'New name'});
  expect(parse({description:''})).toEqual({description:null});
  expect(parse({description:null})).toEqual({description:null});
  expect(parse({})).toEqual({});
  expect(updateGroupSchema.safeParse({params:{groupId:id},query:{},body:{name:''}}).success).toBe(false);
});
test('empty patch requires at least one field or image',async()=>{
  await expect(service.updateGroup({groupId:id,userId:id,input:{}})).rejects.toMatchObject({statusCode:400});
  expect(update).not.toHaveBeenCalled();
});
test('text-only patch does not create an image',async()=>{
  update.mockResolvedValue({group:{id,name:'New name'},cleanupObjects:[]});
  expect(await service.updateGroup({groupId:id,userId:id,input:{name:'New name'}})).toMatchObject({group:{name:'New name'}});
  expect(store).not.toHaveBeenCalled();
});
test('image-only patch maps the saved image',async()=>{
  inspect.mockResolvedValue({temporaryPath:'/tmp/image',extension:'png',mimeType:'image/png'});
  store.mockResolvedValue({storageKey:'group-images/image.png'});
  update.mockResolvedValue({group:{id,cover_asset_id:id,cover_asset_mime_type:'image/png'},cleanupObjects:[]});
  expect(await service.updateGroup({groupId:id,userId:id,input:{},groupImageFile:{path:'/tmp/image'}})).toMatchObject({group:{coverImage:{assetId:id,mimeType:'image/png'}}});
  expect(update).toHaveBeenCalledWith(expect.objectContaining({storedImage:expect.objectContaining({storageKey:'group-images/image.png'})}));
});
test('failed admin authorization cleans a newly stored image',async()=>{
  inspect.mockResolvedValue({temporaryPath:'/tmp/image',extension:'png'});
  store.mockResolvedValue({storageKey:'group-images/image.png'});update.mockResolvedValue(null);
  await expect(service.updateGroup({groupId:id,userId:id,input:{},groupImageFile:{path:'/tmp/image'}})).rejects.toMatchObject({statusCode:404});
  expect(remove).toHaveBeenCalledWith(expect.objectContaining({storageKey:'group-images/image.png'}));
});
