import { jest } from "@jest/globals";

const post = jest.fn();
const warn = jest.fn();
const repository = { listPopularCities: jest.fn(), listPlaces: jest.fn() };
jest.unstable_mockModule("axios", () => ({ default: { post } }));
jest.unstable_mockModule("../../../src/core/logger/logger.js", () => ({ default: { warn } }));
jest.unstable_mockModule("../../../src/modules/explore/repositories/explore.repository.js", () => ({ default: repository }));
jest.unstable_mockModule("../../../src/modules/users/repositories/posts.repository.js", () => ({ default: {} }));
const { default: service } = await import("../../../src/modules/explore/services/explore.service.js");
const { resolveExploreImages } = await import("../../../src/modules/explore/services/explore-images.service.js");
const originalUrl = process.env.ARTICTERN_IMAGE_API_URL;
const originalKey = process.env.ARTICTERN_IMAGE_API_KEY;
const image = { id: "12345678-1234-4234-8234-123456789012", url: "https://media.artictern.com/test.jpg", mimeType: "image/jpeg" };
const rows = [1, 2].map((n) => ({ id: `item-${n}`, name: `Name ${n}`, country_code: "IN", city_name: "Delhi", latitude: null, longitude: null, image_asset_id: "old-image" }));

beforeEach(() => {
  jest.resetAllMocks();
  process.env.ARTICTERN_IMAGE_API_URL = "https://dashboard-api.artictern.com/api/integration/v1";
  process.env.ARTICTERN_IMAGE_API_KEY = "test-secret";
  repository.listPopularCities.mockResolvedValue(rows);
  repository.listPlaces.mockResolvedValue(rows);
});
afterAll(() => {
  for (const [key, value] of [["ARTICTERN_IMAGE_API_URL", originalUrl], ["ARTICTERN_IMAGE_API_KEY", originalKey]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe.each([
  ["cities", "externalCityId", () => service.getCities()],
  ["places", "externalPlaceId", () => service.getCityPlaces({ cityId: "city-id" })],
])("%s image integration", (kind, idField, request) => {
  test("merges by ID, replaces existing images, preserves structure and null, one call", async () => {
    delete process.env.ARTICTERN_IMAGE_API_KEY;
    const before = await request();
    process.env.ARTICTERN_IMAGE_API_KEY = "test-secret";
    post.mockResolvedValue({ data: { images: [
      { [idField]: rows[1].id, image: null },
      { [idField]: rows[0].id, image: { ...image, extra: "ignored" } },
    ] } });
    const after = await request();
    expect(after).toEqual({ ...before, [kind]: before[kind].map((item, index) => ({ ...item, image: index === 0 ? image : null })) });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1][kind]).toHaveLength(2);
    expect(post.mock.calls[0][2]).toMatchObject({ timeout: 5000, maxRedirects: 0 });
    expect(post.mock.calls[0][1][kind][0]).toEqual({ [idField]: rows[0].id, name: rows[0].name, countryCode: "IN", ...(kind === "places" ? { cityName: "Delhi" } : {}) });
  });
  test.each(["timeout", "HTTP error"])("%s preserves the entire normal response without leaking errors", async (message) => {
    delete process.env.ARTICTERN_IMAGE_API_KEY;
    const before = await request();
    process.env.ARTICTERN_IMAGE_API_KEY = "test-secret";
    post.mockRejectedValue(new Error(`${message} test-secret`));
    expect(await request()).toEqual(before);
    expect(post).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test-secret");
  });
  test("caps the single batch and preserves overflow", async () => {
    const cap = kind === "cities" ? 20 : 50;
    const many = Array.from({ length: cap + 1 }, (_, i) => ({ ...rows[0], id: `id-${i}` }));
    repository.listPopularCities.mockResolvedValue(many);
    repository.listPlaces.mockResolvedValue(many);
    post.mockResolvedValue({ data: { images: many.slice(0, cap).map((row) => ({ [idField]: row.id, image: null })) } });
    const result = await request();
    expect(result[kind]).toHaveLength(cap + 1);
    expect(result[kind][cap].image.id).toBe("old-image");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1][kind]).toHaveLength(cap);
  });
});

test("sends provider fields together only", async () => {
  post.mockResolvedValue({ data: { images: rows.map((row) => ({ externalPlaceId: row.id, image: null })) } });
  await resolveExploreImages("places", [{ ...rows[0], provider: "google", provider_id: "google-id" }, { ...rows[1], provider: "google" }]);
  expect(post.mock.calls[0][1].places[0]).toMatchObject({ provider: "google", providerId: "google-id" });
  expect(post.mock.calls[0][1].places[1]).not.toHaveProperty("provider");
});

test("empty input makes no external request", async () => {
  expect(await resolveExploreImages("cities", [])).toBeNull();
  expect(post).not.toHaveBeenCalled();
});

test("malformed response fails closed to existing images", async () => {
  post.mockResolvedValue({ data: { images: [] } });
  expect(await resolveExploreImages("cities", rows)).toBeNull();
  expect(warn).toHaveBeenCalledTimes(1);
});
