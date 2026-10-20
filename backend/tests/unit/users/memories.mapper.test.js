import MemoriesMapper from '../../../src/modules/users/mappers/memories.mapper.js';

test('memory images expose optimized private routes and dimensions without storage keys', () => {
  const memory=MemoriesMapper.toMemory({id:'memory',asset_id:'asset',mime_type:'image/jpeg',
    is_public:false,original_width:1600,original_height:2400,
    image_variants:[{name:'small',width:213,height:320,fileSize:1000,storageKey:'private/key',storageProvider:'r2'}]});
  expect(memory.asset.width).toBe(1600);
  expect(memory.asset.height).toBe(2400);
  expect(memory.asset.imageVariants).toHaveLength(1);
  expect(memory.asset.imageVariants[0]).toMatchObject({size:320,width:213,height:320,mimeType:'image/webp'});
  expect(memory.asset.imageVariants[0].url).toMatch(/\/api\/v1\/media\/assets\/asset\/images\/320$/);
  expect(memory.asset.imageVariants[0]).not.toHaveProperty('storageKey');
});
test('original image URL remains available before variants finish; videos have no image variants', () => {
  expect(MemoriesMapper.toMemory({asset_id:'asset',mime_type:'image/png',is_public:false}).asset.imageVariants).toEqual([]);
  expect(MemoriesMapper.toMemory({asset_id:'asset',mime_type:'video/mp4'}).asset.imageVariants).toBeNull();
});
