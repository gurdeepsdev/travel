import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

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

        /*
         * Never construct a public URL for an asset
         * that is marked private.
         *
         * Private memory delivery will later use the
         * authenticated media endpoint or a signed URL.
         */
        url:
          isPublic
            ? buildAssetUrl(
                row.storage_key,
              )
            : null,

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