import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { access } from 'node:fs/promises';

const store = jest.fn(), remove = jest.fn(), resolve = jest.fn();
const create = jest.fn(), createInTransaction = jest.fn(), get = jest.fn();
const client = {}, transaction = jest.fn(fn => fn(client));
jest.unstable_mockModule('../../../src/database/database-manager.js', () => ({ default: { transaction } }));
jest.unstable_mockModule('../../../src/providers/storage/storage-manager.js', () => ({ default: { store, remove } }));
jest.unstable_mockModule('../../../src/modules/media/media.repository.js', () => ({ default: { resolveUploadedAssets: resolve } }));
jest.unstable_mockModule('../../../src/modules/community/community.service.js', () => ({ default: { create, createInTransaction, get } }));
const { createCommunity } = await import('../../../src/modules/community/community-create.js');
const app = express();
app.use(express.json());
app.post('/communities', (req, res, next) => {
  if (!req.headers.authorization) return res.sendStatus(401);
  req.user = { id: 'user' }; next();
}, createCommunity);
app.use((error, _req, res, _next) => res.status(error.statusCode ?? 500).json({ code: error.code, details: error.details }));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=', 'base64');
const post = () => request(app).post('/communities').set('Authorization', 'Bearer test');
const image = call => call.attach('image', png, { filename: 'photo.png', contentType: 'image/png' });
beforeEach(() => {
  jest.clearAllMocks();
  transaction.mockImplementation(fn => fn(client));
  store.mockResolvedValue({ storageKey: 'community/test.png', storageProvider: 'local', bucket: 'local' });
  resolve.mockResolvedValue({ assets: [{ id: '11111111-1111-4111-8111-111111111111' }], unusedStoredObjects: [], supersededStoredObjects: [] });
  createInTransaction.mockResolvedValue('community');
  get.mockResolvedValue({ community: { id: 'community', conversationId: 'conversation', image: { id: 'image' } } });
  create.mockResolvedValue({ community: { id: 'json-community' } });
});
test.each(['OPEN', 'APPROVAL'])('multipart %s creates image and community using the same transaction', async joinType => {
  const response = await image(post().field('name', ' Delhi ').field('description', 'Travel together').field('joinType', joinType));
  expect(response.status).toBe(201);
  expect(response.body.data.community).toMatchObject({ id: 'community', conversationId: 'conversation' });
  expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ client, userId: 'user', isPublic: true }));
  expect(createInTransaction).toHaveBeenCalledWith('user', { name: 'Delhi', description: 'Travel together', joinType, iconAssetId: '11111111-1111-4111-8111-111111111111' }, client);
  expect(create).not.toHaveBeenCalled();
  const temporaryPath = store.mock.calls[0][0].temporaryPath;
  await expect(access(temporaryPath)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('multipart defaults joinType and permits optional description omission', async () => {
  expect((await image(post().field('name', 'Delhi'))).status).toBe(201);
  expect(createInTransaction).toHaveBeenCalledWith('user', expect.objectContaining({ joinType: 'OPEN' }), client);
});
test('existing JSON creation is unchanged', async () => {
  const response = await post().send({ name: 'Delhi', iconAssetId: '11111111-1111-4111-8111-111111111111' });
  expect(response.status).toBe(201);
  expect(create).toHaveBeenCalledWith('user', { name: 'Delhi', iconAssetId: '11111111-1111-4111-8111-111111111111', joinType: 'OPEN' });
  expect(store).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
});
test('JSON still requires iconAssetId', async () => {
  expect((await post().send({ name: 'Delhi' })).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
test.each([
  ['missing name', {}], ['blank name', { name: ' ' }],
  ['long name', { name: 'a'.repeat(101) }], ['long description', { name: 'Delhi', description: 'a'.repeat(251) }],
  ['unsupported joinType', { name: 'Delhi', joinType: 'PUBLIC' }],
  ['conflicting iconAssetId', { name: 'Delhi', iconAssetId: '11111111-1111-4111-8111-111111111111' }],
  ['unknown field', { name: 'Delhi', extra: 'field' }]
])('%s is rejected before storage', async (_label, fields) => {
  let call = post(); for (const [key, value] of Object.entries(fields)) call = call.field(key, value);
  expect((await image(call)).status).toBe(400); expect(store).not.toHaveBeenCalled();
});
test('image is required for multipart', async () => {
  const response = await post().field('name', 'Delhi');
  expect(response.status).toBe(400); expect(response.body.code).toBe('COMMUNITY.IMAGE_REQUIRED');
});
test('signature validation rejects disguised files', async () => {
  expect((await post().field('name', 'Delhi').attach('image', Buffer.from('invalid'), { filename: 'fake.png', contentType: 'image/png' })).status).toBe(415);
  expect(store).not.toHaveBeenCalled();
});
test('image over 10 MiB is rejected', async () => {
  expect((await post().field('name', 'Delhi').attach('image', Buffer.alloc(10 * 1024 * 1024 + 1), 'large.png')).status).toBe(413);
  expect(store).not.toHaveBeenCalled();
});
test('multiple images are rejected', async () => {
  expect((await image(image(post().field('name', 'Delhi')))).status).toBe(400);
  expect(store).not.toHaveBeenCalled();
});
test('wrong file field is rejected', async () => {
  expect((await post().field('name', 'Delhi').attach('photo', png, 'photo.png')).status).toBe(400);
  expect(store).not.toHaveBeenCalled();
});
test('duplicate text fields are rejected before storage', async () => {
  expect((await image(post().field('name', 'Delhi').field('name', 'Mumbai'))).status).toBe(400);
  expect(store).not.toHaveBeenCalled();
});
test.each([
  ['multipart/form-data', 'invalid multipart'],
  ['multipart/form-data; boundary=broken', '--broken\r\nContent-Disposition: form-data; name="name"\r\n\r\nDelhi']
])('malformed %s returns a client error', async (contentType, body) => {
  const response = await post().set('Content-Type', contentType).send(body);
  expect(response.status).toBe(400); expect(response.body.code).toBe('COMMUNITY.IMAGE_INVALID');
  expect(store).not.toHaveBeenCalled();
});
test('multipart authentication is required before storage', async () => {
  expect((await image(request(app).post('/communities').field('name', 'Delhi'))).status).toBe(401);
  expect(store).not.toHaveBeenCalled();
});
test('community transaction failure cleans the stored file', async () => {
  createInTransaction.mockRejectedValueOnce(new Error('creation failure'));
  expect((await image(post().field('name', 'Delhi'))).status).toBe(500);
  expect(remove).toHaveBeenCalledWith(expect.objectContaining({ storageKey: 'community/test.png' }));
  expect(get).not.toHaveBeenCalled();
});
test('media transaction failure cleans the stored file', async () => {
  resolve.mockRejectedValueOnce(new Error('media failure'));
  expect((await image(post().field('name', 'Delhi'))).status).toBe(500);
  expect(remove).toHaveBeenCalled(); expect(createInTransaction).not.toHaveBeenCalled();
});
test('post-commit response failure does not delete committed media', async () => {
  get.mockRejectedValueOnce(new Error('read failure'));
  expect((await image(post().field('name', 'Delhi'))).status).toBe(500);
  expect(remove).not.toHaveBeenCalled();
});
