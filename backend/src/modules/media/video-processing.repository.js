import Database from "../../database/database-manager.js";

class VideoProcessingRepository {
  async findPendingAssets({
    limit = 1000,
  } = {}) {
    const { rows } =
      await Database.query(
        `
          SELECT
            id,
            storage_key,
            mime_type,
            processing_status

          FROM media.assets

          WHERE deleted_at IS NULL
            AND mime_type LIKE 'video/%'
            AND processing_status =
              'PROCESSING'

          ORDER BY created_at ASC

          LIMIT $1
        `,
        [
          limit,
        ],
      );

    return rows;
  }

  async findProcessableAsset(
    assetId,
  ) {
    const { rows } =
      await Database.query(
        `
          SELECT
            id,
            storage_provider,
            storage_key,
            mime_type,
            processing_status

          FROM media.assets

          WHERE id = $1::uuid
            AND deleted_at IS NULL
            AND mime_type LIKE 'video/%'
            AND processing_status =
              'PROCESSING'

          LIMIT 1
        `,
        [
          assetId,
        ],
      );

    return rows[0] ?? null;
  }

  async markReady({
    assetId,
    storageKey,
    fileSize,
    width,
    height,
    durationSeconds,
    thumbnailStorageKey,
    thumbnailFileSize,
    thumbnailWidth,
    thumbnailHeight,
  }) {
    await Database.transaction(
      async (client) => {
        await client.query(
          `
            UPDATE media.assets
            SET
              storage_key = $2,
              mime_type = 'video/mp4',
              extension = 'mp4',
              file_size = $3,
              original_width = $4,
              original_height = $5,
              duration_seconds = $6,
              processing_status = 'READY',
              processing_error = NULL,
              processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP

            WHERE id = $1::uuid
              AND processing_status =
                'PROCESSING'
          `,
          [
            assetId,
            storageKey,
            fileSize,
            width,
            height,
            durationSeconds,
          ],
        );

        await client.query(
          `
            INSERT INTO media.asset_variants (
              asset_id,
              variant_name,
              format,
              quality,
              width,
              height,
              storage_key,
              file_size
            )
            VALUES (
              $1::uuid,
              'thumbnail',
              'jpg',
              85,
              $2,
              $3,
              $4,
              $5
            )
            ON CONFLICT (
              asset_id,
              variant_name,
              format,
              quality
            )
            DO UPDATE SET
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              storage_key =
                EXCLUDED.storage_key,
              file_size =
                EXCLUDED.file_size,
              updated_at =
                CURRENT_TIMESTAMP
          `,
          [
            assetId,
            thumbnailWidth,
            thumbnailHeight,
            thumbnailStorageKey,
            thumbnailFileSize,
          ],
        );
      },
    );
  }

  async markFailed({
    assetId,
    errorMessage,
  }) {
    await Database.query(
      `
        UPDATE media.assets
        SET
          processing_status = 'FAILED',
          processing_error = $2,
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = $1::uuid
          AND processing_status =
            'PROCESSING'
      `,
      [
        assetId,
        String(
          errorMessage ??
            "Video processing failed.",
        ).slice(
          0,
          500,
        ),
      ],
    );
  }
}

export default new VideoProcessingRepository();
