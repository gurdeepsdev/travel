import { jest } from '@jest/globals';
const get = jest.fn(), query = jest.fn(), listPlaces = jest.fn(), warn = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get } }));
jest.unstable_mockModule('../../../src/database/database-manager.js', () => ({ default: { query } }));
jest.unstable_mockModule('../../../src/core/logger/logger.js', () => ({ default: { warn } }));
jest.unstable_mockModule('../../../src/modules/explore/repositories/explore.repository.js', () => ({ default: { listPlaces } }));
const { listImagePlaces } = await import('../../../src/modules/explore/services/image-places.service.js');
const original = [process.env.ARTICTERN_IMAGE_API_URL, process.env.ARTICTERN_IMAGE_API_KEY];
const image = { id: 'aws', url: 'https://media.artictern.com/x.jpg', mimeType: 'image/jpeg' };
beforeEach(() => {
  jest.resetAllMocks();
  process.env.ARTICTERN_IMAGE_API_URL = 'https://dashboard-api.artictern.com/api/integration/v1';
  process.env.ARTICTERN_IMAGE_API_KEY = 'test-secret';
  query.mockResolvedValue({ rows: [{ name: 'Delhi', code: 'IN' }] });
  get.mockResolvedValue({ data: { places: [{ provider: 'google', providerId: 'google-id', title: 'AWS title', description: 'AWS description', image }], pagination: { hasMore: true, nextCursor: 'next' } } });
  listPlaces.mockResolvedValue([{ id: 'local', name: 'Temple', provider: 'GOOGLE_PLACES', provider_id: 'google-id' }]);
});
afterAll(() => {
  ['ARTICTERN_IMAGE_API_URL', 'ARTICTERN_IMAGE_API_KEY'].forEach((key, i) => {
    if (original[i] === undefined) delete process.env[key]; else process.env[key] = original[i];
  });
});
test('one AWS call; matches provider IDs, not unrelated AWS UUIDs; forwards pagination', async () => {
  const result = await listImagePlaces({ cityId: 'city', limit: 20, cursor: 'previous' });
  expect(result.places[0]).toMatchObject({ id: 'local', name: 'AWS title', description: 'AWS description', image });
  expect(result.pagination).toEqual({ hasMore: true, nextCursor: 'next' });
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][1]).toMatchObject({ params: { cityName: 'Delhi', countryCode: 'IN', limit: 20, cursor: 'previous' }, timeout: 5000 });
  expect(listPlaces).toHaveBeenCalledWith({ cityId: 'city', limit: 50, imageTargets: [{ provider: 'google', providerId: 'google-id' }] });
});
test('unmatched page preserves cursor to reach subsequent matches', async () => {
  listPlaces.mockResolvedValue([]);
  expect(await listImagePlaces({ cityId: 'city', limit: 20 })).toEqual({ cityId: 'city', places: [], pagination: { hasMore: true, nextCursor: 'next' } });
});
test.each([{ title: null }, { title: '   ' }, { description: undefined }, { description: '' }])(
  'excludes missing AWS content without falling back to VPS values: %j', async (change) => {
    get.mockResolvedValue({ data: { places: [{ provider: 'google', providerId: 'google-id',
      title: 'AWS title', description: 'AWS description', image, ...change }],
      pagination: { hasMore: true, nextCursor: 'next' } } });
    const result = await listImagePlaces({ cityId: 'city', limit: 20 });
    expect(result.places).toEqual([]);
    expect(result.pagination).toEqual({ hasMore: true, nextCursor: 'next' });
    expect(listPlaces).not.toHaveBeenCalled();
  });
test('unknown city makes no AWS call', async () => {
  query.mockResolvedValue({ rows: [] });
  expect((await listImagePlaces({ cityId: 'city', limit: 20 })).places).toEqual([]);
  expect(get).not.toHaveBeenCalled();
});
test('outage returns normal empty response and logs no secrets', async () => {
  get.mockRejectedValue(new Error('test-secret'));
  expect((await listImagePlaces({ cityId: 'city', limit: 20 })).places).toEqual([]);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('test-secret');
});
test('invalid cursor returns validation error', async () => {
  get.mockRejectedValue({ response: { status: 400 } });
  await expect(listImagePlaces({ cityId: 'city', limit: 20, cursor: 'bad' })).rejects.toMatchObject({ statusCode: 400 });
});
test('malformed upstream response does not reach repository', async () => {
  get.mockResolvedValue({ data: { places: [{ image: null }] } });
  expect((await listImagePlaces({ cityId: 'city', limit: 20 })).places).toEqual([]);
  expect(listPlaces).not.toHaveBeenCalled();
});
