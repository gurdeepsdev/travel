import { jest } from '@jest/globals';
import sharp from 'sharp';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'artictern-image-test-'));
jest.unstable_mockModule('../../../src/providers/storage/local.provider.js', () => ({ resolveStoragePath: (key) => join(root, key) }));
const { generateImageVariants, createImageProcessor } = await import('../../../src/modules/media/image-processing.service.js');
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

test('real image resize applies orientation, strips EXIF and preserves original', async () => {
  await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#336699' } })
    .jpeg().withMetadata({ orientation: 6 }).toFile(join(root, 'photo.jpg'));
  const original = await readFile(join(root, 'photo.jpg'));
  const variants = await generateImageVariants('photo.jpg');
  expect(variants).toHaveLength(4);
  for (const [index, variant] of variants.entries()) {
    const metadata = await sharp(variant.filePath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.width).toBeLessThan(metadata.height);
    expect(Math.max(metadata.width, metadata.height)).toBe([320,640,1080,1600][index]);
  }
  expect(await readFile(join(root, 'photo.jpg'))).toEqual(original);
});

test('small originals are never upscaled and transparency is preserved', async () => {
  await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(join(root, 'small.png'));
  for (const variant of await generateImageVariants('small.png')) {
    const metadata = await sharp(variant.filePath).metadata();
    expect([metadata.width,metadata.height,metadata.hasAlpha]).toEqual([80,40,true]);
  }
});

function setup({ isPublic = true, isMemory = false, existing = [], failUpload = false, failCommit = false } = {}) {
  const generated = ['small','medium','large','custom'].map((name) => ({ name, storageKey: `source.jpg.images-v1/${name}.webp`, width: 100, height: 100, fileSize: 100 }));
  const query = jest.fn().mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT id')) return { rows: [{ id: 'id', storage_key: 'source.jpg', is_public: isPublic, is_memory: isMemory }] };
    if (sql.startsWith('SELECT variant')) return { rows: existing };
    return { rowCount: 1 };
  });
  const db = { transaction: async (fn) => { const result = await fn({ query }); if (failCommit) throw new Error('commit'); return result; } };
  const objectStorage = { enabled: true, name: 'r2', uploadFile: jest.fn().mockImplementation(async () => { if (failUpload) throw new Error('upload'); }), removeMany: jest.fn().mockResolvedValue() };
  const generate = jest.fn().mockResolvedValue(generated);
  const inspect = jest.fn().mockResolvedValue({width:2400,height:1600,orientation:6});
  return { process: createImageProcessor({ db, objectStorage, generate, inspect }), objectStorage, query, generate, generated };
}

test('memory images persist oriented dimensions and private variants never upload to R2', async () => {
  const s=setup({isPublic:false,isMemory:true});
  await s.process('id');
  const update=s.query.mock.calls.find(([sql])=>sql.startsWith('UPDATE media.assets'));
  expect(update[1]).toEqual(['id',1600,2400]);
  expect(s.objectStorage.uploadFile).not.toHaveBeenCalled();
  expect(s.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT'))).toHaveLength(4);
});

test('public variants upload before persistence; original asset remains unchanged', async () => {
  const s = setup();
  await s.process('id');
  expect(s.objectStorage.uploadFile).toHaveBeenCalledTimes(4);
  expect(s.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT'))).toHaveLength(4);
  expect(s.query.mock.calls.some(([sql]) => /UPDATE media.assets/.test(sql))).toBe(false);
});
test('private variants stay local and previously public variants are withdrawn', async () => {
  const s = setup({ isPublic: false });
  await s.process('id');
  expect(s.objectStorage.uploadFile).not.toHaveBeenCalled();
  const existing = s.generated.map((v) => ({ ...v, storageProvider: 'r2' }));
  const withdrawn = setup({ isPublic: false, existing });
  await withdrawn.process('id');
  expect(withdrawn.generate).not.toHaveBeenCalled();
  expect(withdrawn.objectStorage.removeMany).toHaveBeenCalledTimes(4);
});
test('already processed public variants are idempotent', async () => {
  const fixture = setup();
  const s = setup({ existing: fixture.generated.map((v) => ({ ...v, storageProvider: 'r2' })) });
  await s.process('id');
  expect(s.generate).not.toHaveBeenCalled();
  expect(s.objectStorage.uploadFile).not.toHaveBeenCalled();
});
test('upload failure rejects without committing incomplete variants', async () => {
  const s = setup({ failUpload: true });
  await expect(s.process('id')).rejects.toThrow('upload');
  expect(s.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
});
test('transaction failure removes only newly uploaded objects', async () => {
  const s = setup({ failCommit: true });
  await expect(s.process('id')).rejects.toThrow('commit');
  expect(s.objectStorage.removeMany).toHaveBeenCalledWith(s.generated.map((v) => v.storageKey));
});
