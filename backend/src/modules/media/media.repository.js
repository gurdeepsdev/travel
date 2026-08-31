import Database from "../../database/database-manager.js";

class MediaRepository {
  async findDeliveryContext({
    assetId,
    viewerUserId = null,
  }) {
    const {
      rows,
    } = await Database.query(
      `
        SELECT
          asset.id,
          asset.uploaded_by,
          asset.storage_provider,
          asset.bucket,
          asset.storage_key,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size,
          asset.processing_status,
          asset.is_public,
          asset.created_at

        FROM media.assets asset

        WHERE asset.id = $1
          AND asset.deleted_at
            IS NULL

          AND (
            asset.is_public IS TRUE

            OR (
              $2::uuid IS NOT NULL
              AND asset.uploaded_by =
                $2::uuid
            )
          )

        LIMIT 1
      `,
      [
        assetId,
        viewerUserId,
      ],
    );

    return rows[0] ?? null;
  }

  async findThumbnailDeliveryContext({
    assetId,
    viewerUserId = null,
  }) {
    const { rows } =
      await Database.query(
        `
          SELECT
            asset.id,
            asset.uploaded_by,
            asset.storage_provider,
            asset.processing_status,
            asset.is_public,
            variant.storage_key,
            variant.file_size

          FROM media.assets asset

          INNER JOIN media.asset_variants variant
            ON variant.asset_id = asset.id
            AND variant.variant_name =
              'thumbnail'
            AND variant.format = 'jpg'
            AND variant.quality = 85

          WHERE asset.id = $1::uuid
            AND asset.deleted_at IS NULL
            AND asset.processing_status =
              'READY'
            AND (
              asset.is_public IS TRUE
              OR (
                $2::uuid IS NOT NULL
                AND asset.uploaded_by =
                  $2::uuid
              )
            )

          LIMIT 1
        `,
        [
          assetId,
          viewerUserId,
        ],
      );

    return rows[0] ?? null;
  }


  
    async resolveUploadedAssets({
    client,
    userId,
    isPublic,
    uploads,
  }) {
    const normalizedUploads =
      Array.isArray(uploads)
        ? uploads
        : [];

    const assets = [];

    const unusedStoredObjects = [];

    const supersededStoredObjects = [];

    for (
      const upload of
      normalizedUploads
    ) {
      /*
       * Serialize identical uploads for the same
       * owner inside the current transaction.
       */
      await client.query(
        `
          SELECT
            pg_advisory_xact_lock(
              hashtextextended(
                $1,
                0
              )
            )
        `,
        [
          `${userId}:${upload.checksum}`,
        ],
      );

      const existingResult =
        await client.query(
          `
            SELECT
              asset.id,
              asset.storage_provider,
              asset.bucket,
              asset.storage_key,
              asset.original_filename,
              asset.mime_type,
              asset.extension,
              asset.file_size,
              asset.original_width,
              asset.original_height,
              asset.duration_seconds,
              asset.processing_status,
              asset.is_public,
              asset.created_at,
              asset.deleted_at

            FROM media.assets asset

            WHERE asset.uploaded_by =
                $1
              AND asset.checksum =
                $2

            LIMIT 1

            FOR UPDATE
          `,
          [
            userId,
            upload.checksum,
          ],
        );

      const existingAsset =
        existingResult.rows[0] ??
        null;

      if (
        existingAsset &&
        existingAsset.deleted_at ===
          null
      ) {
        let resolvedAsset =
          existingAsset;

        if (
          isPublic === true &&
          existingAsset.is_public !==
            true
        ) {
          const publicResult =
            await client.query(
              `
                UPDATE media.assets
                SET
                  is_public = TRUE,
                  updated_at =
                    CURRENT_TIMESTAMP

                WHERE id = $1

                RETURNING
                  id,
                  storage_provider,
                  bucket,
                  storage_key,
                  original_filename,
                  mime_type,
                  extension,
                  file_size,
                  original_width,
                  original_height,
                  duration_seconds,
                  processing_status,
                  is_public,
                  created_at,
                  deleted_at
              `,
              [
                existingAsset.id,
              ],
            );

          resolvedAsset =
            publicResult.rows[0];
        }

        assets.push({
          ...resolvedAsset,

          fileIndex:
            upload.fileIndex,
        });

        /*
         * The newly stored object is unnecessary
         * because this user's active asset row
         * already represents the same checksum.
         */
        unusedStoredObjects.push({
          storageKey:
            upload.storageKey,
        });

        continue;
      }

      if (existingAsset) {
        const restoredResult =
          await client.query(
            `
              UPDATE media.assets
              SET
                storage_provider = $2,
                bucket = $3,
                storage_key = $4,
                original_filename = $5,
                mime_type = $6,
                extension = $7,
                file_size = $8,
                checksum = $9,
                original_width = NULL,
                original_height = NULL,
                duration_seconds = NULL,
                processing_status = $11,
                processing_error = NULL,
                processed_at = NULL,
                is_public = $10,
                deleted_at = NULL,
                updated_at =
                  CURRENT_TIMESTAMP

              WHERE id = $1

              RETURNING
                id,
                storage_provider,
                bucket,
                storage_key,
                original_filename,
                mime_type,
                extension,
                file_size,
                original_width,
                original_height,
                duration_seconds,
                processing_status,
                is_public,
                created_at,
                deleted_at
            `,
            [
              existingAsset.id,
              upload.storageProvider,
              upload.bucket,
              upload.storageKey,
              upload.originalFilename,
              upload.mimeType,
              upload.extension,
              upload.fileSize,
              upload.checksum,
              isPublic === true,
              upload.mimeType
                .startsWith("video/")
                  ? "PROCESSING"
                  : "READY",
            ],
          );

        assets.push({
          ...restoredResult.rows[0],

          fileIndex:
            upload.fileIndex,
        });

        if (
          existingAsset.storage_key &&
          existingAsset.storage_key !==
            upload.storageKey
        ) {
          supersededStoredObjects.push({
            storageKey:
              existingAsset.storage_key,
          });
        }

        continue;
      }

      const insertedResult =
        await client.query(
          `
            INSERT INTO media.assets (
              storage_provider,
              bucket,
              storage_key,
              original_filename,
              mime_type,
              extension,
              file_size,
              checksum,
              original_width,
              original_height,
              duration_seconds,
              processing_status,
              uploaded_by,
              is_public
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              NULL,
              NULL,
              NULL,
              $11,
              $9,
              $10
            )
            RETURNING
              id,
              storage_provider,
              bucket,
              storage_key,
              original_filename,
              mime_type,
              extension,
              file_size,
              original_width,
              original_height,
              duration_seconds,
              processing_status,
              is_public,
              created_at,
              deleted_at
          `,
          [
            upload.storageProvider,
            upload.bucket,
            upload.storageKey,
            upload.originalFilename,
            upload.mimeType,
            upload.extension,
            upload.fileSize,
            upload.checksum,
            userId,
            isPublic === true,
            upload.mimeType
              .startsWith("video/")
                ? "PROCESSING"
                : "READY",
          ],
        );

      assets.push({
        ...insertedResult.rows[0],

        fileIndex:
          upload.fileIndex,
      });
    }

    return {
      assets,
      unusedStoredObjects,
      supersededStoredObjects,
    };
  }

  async findOwnedPostAssets({
    client,
    userId,
    assetIds,
  }) {
    const normalizedAssetIds =
      Array.isArray(assetIds)
        ? assetIds
        : [];

    if (
      normalizedAssetIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        SELECT
          asset.id,
          asset.storage_provider,
          asset.bucket,
          asset.storage_key,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size,
          asset.original_width,
          asset.original_height,
          asset.duration_seconds,
          asset.processing_status,
          asset.is_public,
          asset.created_at

        FROM media.assets asset

        WHERE asset.id =
            ANY($1::uuid[])
          AND asset.uploaded_by =
            $2
          AND asset.deleted_at
            IS NULL
          AND (
            asset.mime_type LIKE
              'image/%'
            OR asset.mime_type LIKE
              'video/%'
          )

        FOR KEY SHARE
      `,
      [
        normalizedAssetIds,
        userId,
      ],
    );

    return rows;
  }

  async makeAssetsPublic({
    client,
    assetIds,
  }) {
    const normalizedAssetIds =
      Array.isArray(assetIds)
        ? assetIds
        : [];

    if (
      normalizedAssetIds.length ===
      0
    ) {
      return;
    }

    await client.query(
      `
        UPDATE media.assets
        SET
          is_public = TRUE,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id =
          ANY($1::uuid[])
          AND is_public IS NOT TRUE
      `,
      [
        normalizedAssetIds,
      ],
    );
  }
}

export default new MediaRepository();
