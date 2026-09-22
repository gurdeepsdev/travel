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
  if (!isPublic) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/content`
      : null;
  }

  const baseUrl =
    (
      process.env
        .VIDEO_CDN_PUBLIC_BASE_URL ??
      process.env
        .R2_PUBLIC_BASE_URL
    )?.trim();

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

export const buildAssetThumbnailUrl = (
  input,
) => {
  const {
    assetId,
    storageProvider,
    isPublic,
  } = normalizeOptions(input);

  const thumbnailStorageKey =
    input?.thumbnailStorageKey ??
    null;

  if (!thumbnailStorageKey) {
    return null;
  }

  if (
    String(
      storageProvider ?? "",
    ).trim().toLowerCase() ===
      "local"
  ) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/thumbnail`
      : null;
  }

  if (!isPublic) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/thumbnail`
      : null;
  }

  return buildAssetUrl({
    assetId,
    storageProvider,
    storageKey:
      thumbnailStorageKey,
    isPublic,
  });
};

export const buildAssetStreamUrl = (
  input,
) => {
  const {
    assetId,
    storageProvider,
  } = normalizeOptions(input);

  const hlsManifestStorageKey =
    input?.hlsManifestStorageKey ??
    null;

  if (!hlsManifestStorageKey) {
    return null;
  }

  if (
    String(
      storageProvider ?? "",
    ).trim().toLowerCase() ===
      "local"
  ) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/stream/master.m3u8`
      : null;
  }

  if (input?.isPublic !== true) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/stream/master.m3u8`
      : null;
  }

  return buildAssetUrl({
    assetId,
    storageProvider,
    storageKey:
      hlsManifestStorageKey,
    isPublic:
      input?.isPublic === true,
  });
};

const HLS_RENDITIONS = [
  "360p",
  "540p",
  "720p",
];

export const buildAssetRenditionUrl = (
  input,
  rendition,
) => {
  if (
    !HLS_RENDITIONS.includes(
      rendition,
    ) ||
    !input?.hlsManifestStorageKey
  ) {
    return null;
  }

  const {
    assetId,
    storageProvider,
  } = normalizeOptions(input);

  const requiresAuthenticatedDelivery =
    String(
      storageProvider ?? "",
    ).trim().toLowerCase() ===
      "local" ||
    input?.isPublic !== true;

  if (requiresAuthenticatedDelivery) {
    return assetId
      ? `/api/v1/media/assets/${encodeURIComponent(
          assetId,
        )}/stream/${rendition}/index.m3u8`
      : null;
  }

  const manifestStorageKey =
    String(
      input.hlsManifestStorageKey,
    );
  const manifestDirectory =
    manifestStorageKey.replace(
      /master\.m3u8$/,
      "",
    );

  return buildAssetUrl({
    assetId,
    storageProvider,
    storageKey:
      `${manifestDirectory}${rendition}/index.m3u8`,
    isPublic: true,
  });
};

export const buildAssetStartupStreamUrl = (
  input,
) => buildAssetRenditionUrl(
  input,
  "360p",
);

export const buildAssetRenditionUrls = (
  input,
) => {
  if (!input?.hlsManifestStorageKey) {
    return null;
  }

  return Object.fromEntries(
    HLS_RENDITIONS.map(
      (rendition) => [
        rendition,
        buildAssetRenditionUrl(
          input,
          rendition,
        ),
      ],
    ),
  );
};
