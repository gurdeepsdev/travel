import { jest } from "@jest/globals";
import { updateMyProfileSchema } from "../../../src/modules/users/validations/profile.validation.js";

const get = jest.fn();
const query = jest.fn();
const transaction = jest.fn((work) => work({ query }));
jest.unstable_mockModule("axios", () => ({ default: { get } }));
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({ default: { transaction } }));
const { resolveProfileLocation, resolvePostCityLocation } = await import("../../../src/modules/users/services/profile-location.service.js");
const countryId = "060de7c3-9c68-4507-aff7-62a5411bf60a";
const cityId = "187cef7e-0554-42f0-a0b9-4e44b9824cee";
const googleCountry = "ChIJcountry12345678901234";
const googleCity = "ChIJLbZ-NFv9DDkRQJY4FbcFcgM";
const previousKey = process.env.GOOGLE_PLACES_API_KEY;
const country = { id: countryId, code: "IN", is_active: true };
const city = { id: cityId, country_id: countryId, is_active: true };
function response(id, kind, code = "IN") {
  return { data: { id, types: [kind], addressComponents: [
    { types: ["country"], shortText: code, longText: "India" },
    { types: ["locality"], longText: "Delhi" },
    { types: ["administrative_area_level_1"], longText: "Delhi" },
  ], location: { latitude: 28.7, longitude: 77.1 } } };
}
beforeEach(() => {
  jest.clearAllMocks();
  get.mockReset(); query.mockReset();
  process.env.GOOGLE_PLACES_API_KEY = "test-only-secret";
  get.mockImplementation(async (url) => url.endsWith(googleCountry) ? response(googleCountry, "country") : response(googleCity, "locality"));
  query.mockImplementation(async (sql) => ({ rows: sql.includes("FROM poi.countries") ? [country] : sql.includes("FROM poi.cities") ? [city] : [] }));
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = previousKey;
});

test.each([{ countryId, cityId }, { countryId: null, cityId: null }, { bio: "hello" }])("preserves existing UUID/null/omitted fields: %j", async (changes) => {
  expect(await resolveProfileLocation(changes, {})).toBe(changes);
  expect(get).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
});
test("accepts Google IDs in existing request fields", () => {
  const body = { countryId: googleCountry, cityId: googleCity };
  expect(updateMyProfileSchema.parse({ body, params: {}, query: {} }).body).toEqual(body);
});
test.each(["https://evil.example/place", "", "bad id", "a".repeat(256)])("rejects malformed ID %s", (id) => {
  expect(updateMyProfileSchema.safeParse({ body: { cityId: id }, params: {}, query: {} }).success).toBe(false);
});
test("resolves both Google IDs without mutating the input", async () => {
  const changes = { countryId: googleCountry, cityId: googleCity, bio: "unchanged" };
  expect(await resolveProfileLocation(changes, {})).toEqual({ countryId, cityId, bio: "unchanged" });
  expect(changes.cityId).toBe(googleCity);
  expect(get).toHaveBeenCalledTimes(2);
  expect(get.mock.calls[0][1]).toMatchObject({ timeout: 5000, maxRedirects: 0 });
});
test("city-only Google update uses current country", async () => {
  expect(await resolveProfileLocation({ cityId: googleCity }, { country_id: countryId })).toEqual({ cityId });
  expect(get).toHaveBeenCalledTimes(1);
});
test("Google country and UUID city are supported", async () => {
  expect(await resolveProfileLocation({ countryId: googleCountry, cityId }, {})).toEqual({ countryId, cityId });
});
test("rejects Google country/city mismatch before writing", async () => {
  get.mockResolvedValueOnce(response(googleCountry, "country", "FR")).mockResolvedValueOnce(response(googleCity, "locality"));
  await expect(resolveProfileLocation({ countryId: googleCountry, cityId: googleCity }, {})).rejects.toMatchObject({ code: "PROFILE.CITY_COUNTRY_MISMATCH" });
  expect(transaction).not.toHaveBeenCalled();
});
test("rejects mismatch with current internal country", async () => {
  query.mockResolvedValue({ rows: [{ ...country, code: "FR" }] });
  await expect(resolveProfileLocation({ cityId: googleCity }, { country_id: countryId })).rejects.toMatchObject({ code: "PROFILE.CITY_COUNTRY_MISMATCH" });
});
test("does not reactivate inactive countries", async () => {
  query.mockResolvedValue({ rows: [{ ...country, is_active: false }] });
  await expect(resolveProfileLocation({ countryId: googleCountry }, {})).rejects.toMatchObject({ code: "PROFILE.COUNTRY_NOT_FOUND" });
});
test("does not reactivate inactive cities", async () => {
  query.mockImplementation(async (sql) => ({ rows: sql.includes("FROM poi.countries") ? [country] : sql.includes("FROM poi.cities") ? [{ ...city, is_active: false }] : [] }));
  await expect(resolveProfileLocation({ countryId, cityId: googleCity }, {})).rejects.toMatchObject({ code: "PROFILE.CITY_NOT_FOUND" });
});
test("reuses existing provider city without inserting duplicate locations", async () => {
  await resolveProfileLocation({ countryId, cityId: googleCity }, {});
  expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
  expect(query.mock.calls.some(([sql]) => sql.includes("pg_advisory_xact_lock"))).toBe(true);
});
test("creates missing verified country, region, and city with parameterized SQL", async () => {
  query.mockImplementation(async (sql) => ({ rows:
    sql.includes("INSERT INTO poi.countries") ? [country] :
    sql.includes("INSERT INTO poi.regions") ? [{ id: "region-id", is_active: true }] :
    sql.includes("INSERT INTO poi.cities") ? [city] : [] }));
  expect(await resolveProfileLocation({ countryId: googleCountry, cityId: googleCity }, {})).toEqual({ countryId, cityId });
  const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO poi.cities"));
  expect(insert[1]).toEqual(["region-id", countryId, "Delhi", googleCity, 28.7, 77.1]);
});
test("missing key fails without database writes", async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  await expect(resolveProfileLocation({ countryId: googleCountry }, {})).rejects.toMatchObject({ statusCode: 503 });
  expect(transaction).not.toHaveBeenCalled();
});
test.each([404, 403, 429, undefined])("provider error %s is sanitized", async (status) => {
  get.mockRejectedValue({ response: { status }, message: "test-only-secret", config: { headers: { key: "test-only-secret" } } });
  try {
    await resolveProfileLocation({ countryId: googleCountry }, {});
    throw new Error("Expected failure");
  } catch (error) {
    expect(error.statusCode).toBe(status === 404 ? 422 : 503);
    expect(JSON.stringify(error)).not.toContain("test-only-secret");
    expect(error.cause).toBeUndefined();
  }
  expect(transaction).not.toHaveBeenCalled();
});
test("rejects businesses passed as cities", async () => {
  get.mockResolvedValue(response(googleCity, "restaurant"));
  await expect(resolveProfileLocation({ cityId: googleCity }, {})).rejects.toMatchObject({ code: "PROFILE.CITY_NOT_FOUND" });
  expect(transaction).not.toHaveBeenCalled();
});

test("post city resolution derives country from Google and uses the caller transaction", async () => {
  expect(await resolvePostCityLocation(googleCity, { query })).toEqual({ id: cityId, name: "Delhi" });
  expect(transaction).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(1);
});
test("post resolver creates missing location records in the caller transaction", async () => {
  query.mockImplementation(async (sql) => ({ rows:
    sql.includes("INSERT INTO poi.countries") ? [country] :
    sql.includes("INSERT INTO poi.regions") ? [{ id: "region-id", is_active: true }] :
    sql.includes("INSERT INTO poi.cities") ? [city] : [] }));
  expect(await resolvePostCityLocation(googleCity, { query })).toEqual({ id: cityId, name: "Delhi" });
  expect(transaction).not.toHaveBeenCalled();
});
test("post resolver preserves inactive city rejection", async () => {
  query.mockImplementation(async (sql) => ({ rows: sql.includes("FROM poi.countries") ? [country] : sql.includes("FROM poi.cities") ? [{ ...city, is_active: false }] : [] }));
  await expect(resolvePostCityLocation(googleCity, { query })).rejects.toMatchObject({ code: "POST.PLACE_NOT_ALLOWED", statusCode: 404 });
});
test("post resolver maps provider outage without credentials", async () => {
  get.mockRejectedValue(new Error("test-only-secret"));
  await expect(resolvePostCityLocation(googleCity, { query })).rejects.toMatchObject({ code: "POST.LOCATION_LOOKUP_UNAVAILABLE", statusCode: 503 });
  expect(query).not.toHaveBeenCalled();
});
test("post resolver rejects businesses and arbitrary internal UUIDs", async () => {
  get.mockResolvedValue(response(googleCity, "restaurant"));
  await expect(resolvePostCityLocation(googleCity, { query })).rejects.toMatchObject({ code: "POST.PLACE_NOT_ALLOWED" });
  await expect(resolvePostCityLocation(cityId, { query })).rejects.toMatchObject({ code: "POST.PLACE_NOT_ALLOWED" });
  expect(query).not.toHaveBeenCalled();
});

test.each(["administrative_area_level_1", "administrative_area_level_2"])("accepts Google %s selections using the matching component", async (type) => {
  get.mockResolvedValue({ data: {
    id: googleCity,
    types: [type, "political"],
    addressComponents: [
      { longText: "Delhi", shortText: "DL", types: ["administrative_area_level_1", "political"] },
      { longText: "Delhi Division", types: ["administrative_area_level_2", "political"] },
      { longText: "India", shortText: "IN", types: ["country", "political"] },
    ],
  } });
  query.mockImplementation(async (sql) => ({ rows:
    sql.includes("FROM poi.countries") ? [country] :
    sql.includes("FROM poi.regions") ? [{ id: "region-id", is_active: true }] :
    sql.includes("INSERT INTO poi.cities") ? [city] : [] }));
  expect(await resolveProfileLocation({ countryId, cityId: googleCity }, {})).toEqual({ countryId, cityId });
  const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO poi.cities"));
  expect(insert[1][2]).toBe(type === "administrative_area_level_1" ? "Delhi" : "Delhi Division");
});

test("does not use a parent region when the selected city's component is missing", async () => {
  get.mockResolvedValue({ data: { ...response(googleCity, "locality").data,
    addressComponents: response(googleCity, "locality").data.addressComponents.filter((part) => !part.types.includes("locality")),
  } });
  await expect(resolveProfileLocation({ countryId, cityId: googleCity }, {})).rejects.toMatchObject({ code: "PROFILE.CITY_NOT_FOUND" });
  expect(transaction).not.toHaveBeenCalled();
});
