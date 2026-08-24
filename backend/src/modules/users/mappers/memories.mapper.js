import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

const buildAbsoluteAssetUrl = (
  asset,
) => {
  const assetUrl =
    buildAssetUrl(asset);

  if (
    !assetUrl ||
    /^https?:\/\//i.test(assetUrl)
  ) {
    return assetUrl;
  }

  const configuredBaseUrl =
    process.env
      .API_PUBLIC_BASE_URL
      ?.trim();

  const baseUrl =
    configuredBaseUrl ||
    `http://localhost:${
      process.env.APP_PORT || 3001
    }`;

  return `${baseUrl.replace(
    /\/+$/,
    "",
  )}/${assetUrl.replace(
    /^\/+/,
    "",
  )}`;
};

class MemoriesMapper {
  static toMemory(row) {
    if (!row) {
      return null;
    }

    const isPublic =
      row.is_public === true;

    return {
      id:
        row.id,

      memoryType:
        row.memory_type,

      createdAt:
        row.created_at,

      asset: {
        id:
          row.asset_id,

        originalFilename:
          row.original_filename ??
          null,

        mimeType:
          row.mime_type ??
          null,

        extension:
          row.extension ??
          null,

        fileSize:
          row.file_size === null ||
          row.file_size === undefined
            ? null
            : Number(
                row.file_size,
              ),

        width:
          row.original_width ??
          null,

        height:
          row.original_height ??
          null,

        durationSeconds:
          row.duration_seconds ??
          null,

        isPublic,

        url:
          buildAbsoluteAssetUrl({
            assetId:
              row.asset_id,

            storageProvider:
              row.storage_provider,

            storageKey:
              row.storage_key,

            isPublic,
          }),

        createdAt:
          row.asset_created_at ??
          null,
      },
    };
  }

  static toSaveResponse({
    memory,
  }) {
    return {
      memory:
        this.toMemory(memory),
    };
  }

  static toListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      memories: (rows ?? [])
        .map((row) =>
          this.toMemory(row),
        )
        .filter(Boolean),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ?? null,
      },
    };
  }
}

export default MemoriesMapper;
