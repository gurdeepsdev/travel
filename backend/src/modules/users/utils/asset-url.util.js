const normalizePath = (
  storageKey,
) =>
  String(storageKey)
    .split("/")
    .filter(Boolean)
    .map(
      (part) =>
        encodeURIComponent(part),
    )
    .join("/");

function normalizeOptions(
  input,
) {
  if (
    input &&
    typeof input === "object"
  ) {
    return {
      assetId:
        input.assetId ?? null,

      storageProvider:
        input.storageProvider ??
        null,

      storageKey:
        input.storageKey ?? null,

      isPublic:
        input.isPublic === true,
    };
  }

  /*
   * Backward compatibility for existing callers
   * that pass only a storage key. Existing assets
   * currently use the public R2 base URL.
   */
  return {
    assetId: null,

    storageProvider:
      "r2",

    storageKey:
      input ?? null,

    isPublic: true,
  };
}

/**
 * Builds a client-facing URL for a public asset.
 *
 * Local assets use an API endpoint so access can
 * be checked against media.assets before delivery.
 * R2 assets continue using the configured public
 * base URL.
 */
export const buildAssetUrl = (
  input,
) => {
  const {
    assetId,
    storageProvider,
    storageKey,
    isPublic,
  } = normalizeOptions(input);

  if (!storageKey) {
    return null;
  }

  const normalizedProvider =
    String(
      storageProvider ?? "",
    )
      .trim()
      .toLowerCase();

  if (
    normalizedProvider ===
    "local"
  ) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/content`
      : null;
  }
  /*
   * Non-local private assets require a signed
   * URL implementation and must not use the
   * public R2 base URL.
   */
  if (!isPublic) {
    return null;
  }

  const baseUrl =
    process.env
      .R2_PUBLIC_BASE_URL
      ?.trim();

  if (!baseUrl) {
    return null;
  }

  const normalizedBaseUrl =
    baseUrl.replace(
      /\/+$/,
      "",
    );

  const normalizedStorageKey =
    normalizePath(
      storageKey,
    );

  return normalizedStorageKey
    ? `${normalizedBaseUrl}/${normalizedStorageKey}`
    : null;
};