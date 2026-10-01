import axios from "axios";
import logger from "../../../core/logger/logger.js";

export async function resolveExploreImages(kind, rows) {
  if (!rows.length) return null;
  const baseUrl = process.env.ARTICTERN_IMAGE_API_URL?.trim();
  const key = process.env.ARTICTERN_IMAGE_API_KEY?.trim();
  if (!baseUrl || !key) return null;

  const cities = kind === "cities";
  const idField = cities ? "externalCityId" : "externalPlaceId";
  const selected = rows.slice(0, cities ? 20 : 50);
  try {
    if (new URL(baseUrl).protocol !== "https:") throw new Error();
    const payload = selected.map((row) => ({
      [idField]: row.id,
      name: row.name,
      countryCode: row.country_code,
      ...(!cities ? {
        cityName: row.city_name,
        ...(row.provider && row.provider_id ? {
          provider: row.provider,
          providerId: row.provider_id,
        } : {}),
      } : {}),
    }));
    const { data } = await axios.post(
      `${baseUrl.replace(/\/+$/, "")}/${cities ? "city" : "place"}-images/resolve`,
      { [kind]: payload },
      {
        headers: { "Content-Type": "application/json", "X-Integration-Key": key },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
      },
    );
    if (!Array.isArray(data?.images)) throw new Error();
    const requested = new Set(selected.map((row) => row.id));
    const images = new Map();
    for (const entry of data.images) {
      if (!requested.has(entry?.[idField])) continue;
      if (images.has(entry[idField])) throw new Error();
      const image = entry.image;
      if (image !== null && (
        !image || typeof image.id !== "string" ||
        typeof image.url !== "string" ||
        !image.url.startsWith("https://") ||
        typeof image.mimeType !== "string" ||
        !image.mimeType.startsWith("image/")
      )) throw new Error();
      images.set(entry[idField], image === null ? null : {
        id: image.id, url: image.url, mimeType: image.mimeType,
      });
    }
    // Treat incomplete batches as integration failures, preserving existing images.
    if (images.size !== requested.size) throw new Error();
    return images;
  } catch {
    // HTTP client errors can contain request headers and credentials.
    logger.warn({ integration: "explore-images", kind }, "Image resolution failed; preserving Explore response.");
    return null;
  }
}
