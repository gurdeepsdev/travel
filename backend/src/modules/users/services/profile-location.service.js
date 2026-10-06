import axios from "axios";
import Database from "../../../database/database-manager.js";
import AppError from "../../../core/errors/app-error.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const external = (id) => typeof id === "string" && !UUID.test(id);
const fail = (code, message, statusCode = 422) => {
  throw new AppError({ code: `PROFILE.${code}`, message, statusCode });
};
const mismatch = () => fail("CITY_COUNTRY_MISMATCH", "Selected city does not belong to the selected country.");

async function details(id, kind) {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) fail("LOCATION_LOOKUP_UNAVAILABLE", "Google location lookup is not configured.", 503);
  let data;
  try {
    ({ data } = await axios.get(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      params: { languageCode: "en" },
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,types,addressComponents,location" +
        (kind === "post" ? ",displayName,businessStatus,formattedAddress" : "") },
      timeout: 5000, maxRedirects: 0, maxContentLength: 256 * 1024,
    }));
  } catch (error) {
    // Never attach provider errors: Axios includes secret request headers.
    if ([400, 404].includes(error.response?.status)) {
      fail(`${kind.toUpperCase()}_NOT_FOUND`, `Selected ${kind} was not found.`);
    }
    fail("LOCATION_LOOKUP_UNAVAILABLE", "Google location lookup is temporarily unavailable.", 503);
  }
  const component = (type) => data?.addressComponents?.find((part) => part.types?.includes(type));
  const country = component("country");
  // Google classifies some city selections (including Delhi) as administrative areas.
  // Match the selected place's type, not an enclosing address component.
  const cityTypes = ["locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2", "administrative_area_level_1"];
  const city = cityTypes.filter((type) => data?.types?.includes(type))
    .map(component).find((part) => part?.longText);
  if (kind === "post" && !city) {
    const parent = cityTypes.map(component).find((part) => part?.longText);
    if (!data?.id || !data?.types?.some((type) => ["point_of_interest", "establishment"].includes(type)) ||
        !parent || !data.displayName?.text?.trim() || data.businessStatus === "CLOSED_PERMANENTLY" ||
        !/^[A-Z]{2}$/.test(country?.shortText || "") || !country?.longText) {
      fail("PLACE_NOT_FOUND", "Select a valid Google place.");
    }
    return { id: data.id, isPlace: true, name: data.displayName.text.trim(),
      cityName: parent.longText, code: country.shortText, countryName: country.longText,
      region: component("administrative_area_level_1")?.longText,
      address: data.formattedAddress ?? null,
      latitude: data.location?.latitude ?? null, longitude: data.location?.longitude ?? null };
  }
  const validType = kind === "country" ? data?.types?.includes("country")
    : Boolean(city);
  if (!data?.id || !validType || !/^[A-Z]{2}$/.test(country?.shortText || "") ||
      !country?.longText || (kind === "city" && !city?.longText)) {
    fail(`${kind.toUpperCase()}_NOT_FOUND`, `Select a valid Google ${kind}.`);
  }
  return { id: data.id, code: country.shortText, countryName: country.longText,
    name: city?.longText, region: component("administrative_area_level_1")?.longText,
    latitude: data.location?.latitude ?? null, longitude: data.location?.longitude ?? null };
}

export async function resolveProfileLocation(changes, currentProfile) {
  if (!external(changes.countryId) && !external(changes.cityId)) return changes;
  const country = external(changes.countryId) ? await details(changes.countryId, "country") : null;
  const city = external(changes.cityId) ? await details(changes.cityId, "city") : null;
  if (country && city && country.code !== city.code) mismatch();

  return Database.transaction((client) => persistLocation(changes, currentProfile, country, city, client));
}

// Post creation supplies its transaction so location creation rolls back with the post.
export async function resolvePostCityLocation(cityId, client) {
  try {
    if (!external(cityId) || !/^[A-Za-z0-9_-]{20,255}$/.test(cityId)) {
      fail("CITY_NOT_FOUND", "Select a valid Google city.");
    }
    const city = await details(cityId, "post");
    if (city.isPlace) return await persistPostPlace(city, client);
    const result = await persistLocation({}, {}, city, city, client);
    return { id: result.cityId, name: city.name };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    throw new AppError({
      code: error.statusCode === 503 ? "POST.LOCATION_LOOKUP_UNAVAILABLE" : "POST.PLACE_NOT_ALLOWED",
      message: error.statusCode === 503 ? "Google location lookup is temporarily unavailable." : "Post city was not found or is not available.",
      statusCode: error.statusCode === 503 ? 503 : 404,
    });
  }
}

async function persistPostPlace(place, client) {
  const one = async (sql, params) => (await client.query(sql, params)).rows[0];
  const { countryId } = await persistLocation({}, {}, place, null, client);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`post-place:${place.id}`]);
  const existing = await one(`SELECT place.id, place.city_id, place.is_closed, city.is_active
    FROM poi.places place JOIN poi.cities city ON city.id = place.city_id
    WHERE place.provider = 'GOOGLE_PLACES' AND place.provider_id = $1 FOR UPDATE OF place, city`, [place.id]);
  if (existing) {
    if (existing.is_closed || !existing.is_active) fail("PLACE_NOT_FOUND", "Selected place is unavailable.");
    return { id: existing.city_id, place_id: existing.id };
  }
  const regionName = place.region || place.countryName;
  if (place.name.length > 50 || place.cityName.length > 50 || regionName.length > 50 ||
      place.id.length > 100 || (place.address?.length ?? 0) > 300) {
    fail("PLACE_NOT_FOUND", "Location exceeds the supported length.");
  }
  let region = await one(`SELECT id, is_active FROM poi.regions
    WHERE country_id = $1 AND LOWER(name) = LOWER($2) FOR UPDATE`, [countryId, regionName]);
  if (!region) region = await one(`INSERT INTO poi.regions (country_id, name) VALUES ($1, $2)
    ON CONFLICT (country_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id, is_active`, [countryId, regionName]);
  if (!region.is_active) fail("PLACE_NOT_FOUND", "Selected region is inactive.");
  let city = await one(`SELECT id, is_active FROM poi.cities
    WHERE region_id = $1 AND LOWER(name) = LOWER($2) FOR UPDATE`, [region.id, place.cityName]);
  // Address components have no parent city Place ID; never store the POI ID as a city ID.
  if (!city) city = await one(`INSERT INTO poi.cities (region_id, country_id, name)
    VALUES ($1, $2, $3) RETURNING id, is_active`, [region.id, countryId, place.cityName]);
  if (!city.is_active) fail("PLACE_NOT_FOUND", "Selected city is inactive.");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["post-category:other"]);
  let category = await one(`SELECT id, is_active FROM poi.categories WHERE LOWER(name) = 'other'
    ORDER BY id LIMIT 1 FOR UPDATE`, []);
  if (!category) category = await one(`INSERT INTO poi.categories (name) VALUES ('Other')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, is_active`, []);
  if (!category.is_active) fail("PLACE_NOT_FOUND", "Default place category is inactive.");
  const record = await one(`INSERT INTO poi.places
    (city_id, region_id, country_id, category_id, name, provider, provider_id, address, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, 'GOOGLE_PLACES', $6, $7, $8, $9)
    RETURNING id`, [city.id, region.id, countryId, category.id, place.name, place.id,
    place.address, place.latitude, place.longitude]);
  return { id: city.id, place_id: record.id };
}

async function persistLocation(changes, currentProfile, country, city, client) {
    const one = async (sql, params) => (await client.query(sql, params)).rows[0];
    const result = { ...changes };
    let selectedCountry;
    if (country) {
      // Serialize same-country resolutions, including first-time region/city creation.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`profile-country:${country.code}`]);
      selectedCountry = await one("SELECT id, code, is_active FROM poi.countries WHERE UPPER(code) = $1 FOR UPDATE", [country.code]);
      if (!selectedCountry) {
        if (country.countryName.length > 50) fail("COUNTRY_NOT_FOUND", "Country name exceeds the supported length.");
        selectedCountry = await one(`INSERT INTO poi.countries (name, code) VALUES ($1, $2)
          ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id, code, is_active`, [country.countryName, country.code]);
      }
      result.countryId = selectedCountry.id;
    } else {
      const id = Object.hasOwn(changes, "countryId") ? changes.countryId : currentProfile.country_id;
      selectedCountry = id ? await one("SELECT id, code, is_active FROM poi.countries WHERE id = $1::uuid FOR UPDATE", [id]) : null;
    }
    if (!selectedCountry?.is_active) fail("COUNTRY_NOT_FOUND", "Selected country was not found or is inactive.");
    if (city) {
      if (selectedCountry.code.toUpperCase() !== city.code) mismatch();
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`profile-city:${city.id}`]);
      let record = await one(`SELECT id, country_id, is_active FROM poi.cities
        WHERE provider = 'GOOGLE_PLACES' AND provider_id = $1 FOR UPDATE`, [city.id]);
      if (!record) {
        const regionName = city.region || city.countryName;
        if (city.name.length > 50 || regionName.length > 50) fail("CITY_NOT_FOUND", "Location name exceeds the supported length.");
        let region = await one("SELECT id, is_active FROM poi.regions WHERE country_id = $1 AND LOWER(name) = LOWER($2) FOR UPDATE", [selectedCountry.id, regionName]);
        if (!region) region = await one(`INSERT INTO poi.regions (country_id, name) VALUES ($1, $2)
          ON CONFLICT (country_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id, is_active`, [selectedCountry.id, regionName]);
        if (!region.is_active) fail("CITY_NOT_FOUND", "Selected city region is inactive.");
        record = await one(`SELECT id, country_id, is_active, provider, provider_id FROM poi.cities
          WHERE region_id = $1 AND LOWER(name) = LOWER($2) FOR UPDATE`, [region.id, city.name]);
        if (record && record.provider_id && (record.provider !== "GOOGLE_PLACES" || record.provider_id !== city.id)) {
          fail("CITY_NOT_FOUND", "Selected city conflicts with an existing location.");
        }
        if (!record) record = await one(`INSERT INTO poi.cities
          (region_id, country_id, name, provider, provider_id, latitude, longitude)
          VALUES ($1, $2, $3, 'GOOGLE_PLACES', $4, $5, $6)
          RETURNING id, country_id, is_active`, [region.id, selectedCountry.id, city.name, city.id, city.latitude, city.longitude]);
      }
      if (!record.is_active) fail("CITY_NOT_FOUND", "Selected city was not found or is inactive.");
      if (record.country_id !== selectedCountry.id) mismatch();
      result.cityId = record.id;
    }
    return result;
}
