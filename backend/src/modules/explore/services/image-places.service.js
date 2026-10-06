import axios from "axios";
import Database from "../../../database/database-manager.js";
import AppError from "../../../core/errors/app-error.js";
import logger from "../../../core/logger/logger.js";
import repository from "../repositories/explore.repository.js";
import mapper from "../mappers/explore.mapper.js";

export async function listImagePlaces({ cityId, limit, cursor }) {
  const { rows: [city] } = await Database.query(`SELECT city.name, country.code
    FROM poi.cities city JOIN poi.countries country ON country.id = city.country_id
    WHERE city.id = $1::uuid AND city.is_active IS TRUE`, [cityId]);
  const empty = { cityId, places: [], pagination: { hasMore: false, nextCursor: null } };
  if (!city) return empty;
  let data;
  try {
    const url = process.env.ARTICTERN_IMAGE_API_URL?.trim();
    const key = process.env.ARTICTERN_IMAGE_API_KEY?.trim();
    if (!key || new URL(url).protocol !== "https:") throw new Error();
    ({ data } = await axios.get(`${url.replace(/\/+$/, "")}/place-images`, {
      params: { cityName: city.name, countryCode: city.code, limit, ...(cursor ? { cursor } : {}) },
      headers: { "X-Integration-Key": key }, timeout: 5000, maxRedirects: 0, maxContentLength: 1024 * 1024,
    }));
    if (!Array.isArray(data?.places) || data.places.length > limit ||
        typeof data.pagination?.hasMore !== "boolean" ||
        (data.pagination.hasMore ? typeof data.pagination.nextCursor !== "string" || !data.pagination.nextCursor : data.pagination.nextCursor !== null) ||
        data.places.some((p) => !p || typeof p.provider !== "string" || !p.provider ||
          typeof p.providerId !== "string" || !p.providerId || typeof p.image?.id !== "string" ||
          typeof p.image?.url !== "string" || !p.image.url.startsWith("https://media.artictern.com/") ||
          typeof p.image?.mimeType !== "string" || !p.image.mimeType.startsWith("image/"))) throw new Error();
  } catch (error) {
    if (cursor && error.response?.status === 400) throw new AppError({
      code: "COMMON.VALIDATION_FAILED", message: "Invalid places cursor.", statusCode: 400,
    });
    logger.warn({ integration: "explore-images" }, "Published place listing failed.");
    return empty;
  }
  const targets = data.places.map(({ provider, providerId }) => ({ provider, providerId }));
  const rows = targets.length ? await repository.listPlaces({ cityId, limit: 50, imageTargets: targets }) : [];
  const images = new Map(data.places.map((p) => [JSON.stringify([p.provider, p.providerId]), p.image]));
  return { cityId, places: rows.map((row) => {
    const provider = row.provider?.toLowerCase() === "google_places" ? "google" : row.provider?.toLowerCase();
    const image = images.get(JSON.stringify([provider, row.provider_id]));
    return image ? { ...mapper.toPlace(row), image: { id: image.id, url: image.url, mimeType: image.mimeType } } : null;
  }).filter(Boolean), pagination: { hasMore: data.pagination.hasMore, nextCursor: data.pagination.nextCursor } };
}
