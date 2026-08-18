import Database from "../../../database/database-manager.js";

class MemoriesRepository {
  /**
   * Saves an owned media asset as a memory.
   *
   * The conditional asset query enforces:
   * - the asset exists;
   * - the asset belongs to this user;
   * - the asset has not been soft-deleted;
   * - IMAGE points to image media;
   * - VIDEO and BOOMERANG point to video media.
   *
   * ON CONFLICT keeps repeated requests idempotent.
   * If the classification changes between VIDEO and
   * BOOMERANG, the existing row is updated.
   */
   async save({
    userId,
    assetId,
    memoryType,
    client = null,
  }) {

        const executeQuery =
      client
        ? client.query.bind(
            client,
          )
        : Database.query.bind(
            Database,
          );
    const sql = `
      WITH eligible_asset AS (
        SELECT
          asset.id

        FROM media.assets asset

        WHERE asset.id =
            $2::uuid

          AND asset.uploaded_by =
            $1::uuid

          AND asset.deleted_at
            IS NULL

          AND (
            (
              $3::varchar = 'IMAGE'

              AND LOWER(
                asset.mime_type
              ) LIKE 'image/%'
            )

            OR (
              $3::varchar IN (
                'VIDEO',
                'BOOMERANG'
              )

              AND LOWER(
                asset.mime_type
              ) LIKE 'video/%'
            )
          )

        FOR KEY SHARE
      ),

      saved_memory AS (
        INSERT INTO users.memories
          AS memory (
            user_id,
            asset_id,
            memory_type
          )

        SELECT
          $1::uuid,
          eligible_asset.id,
          $3::varchar

        FROM eligible_asset

        ON CONFLICT (
          user_id,
          asset_id
        )
        DO UPDATE SET
          memory_type =
            EXCLUDED.memory_type

        RETURNING
          memory.id,
          memory.user_id,
          memory.asset_id,
          memory.memory_type,
          memory.created_at
      )

      SELECT
        saved_memory.id,
        saved_memory.user_id,
        saved_memory.asset_id,
        saved_memory.memory_type,
        saved_memory.created_at,

        saved_memory.created_at::text
          AS cursor_created_at,

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
        asset.is_public,
        asset.created_at
          AS asset_created_at

      FROM saved_memory

      INNER JOIN media.assets asset
        ON asset.id =
          saved_memory.asset_id
    `;

    const { rows } = await executeQuery(      sql,
      [
        userId,
        assetId,
        memoryType,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Returns only the authenticated user's active
   * memory assets in newest-first order.
   */
  async listMine({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),
      50,
    );

    const params = [
      userId,
    ];

    let cursorCondition = "";

    if (cursor) {
      params.push(
        cursor.createdAt,
      );

      params.push(
        cursor.id,
      );

      cursorCondition = `
        AND (
          memory.created_at,
          memory.id
        ) < (
          $2::timestamp,
          $3::uuid
        )
      `;
    }

    params.push(
      safeLimit + 1,
    );

    const limitParameterIndex =
      params.length;

    const sql = `
      SELECT
        memory.id,
        memory.user_id,
        memory.asset_id,
        memory.memory_type,
        memory.created_at,

        memory.created_at::text
          AS cursor_created_at,

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
        asset.is_public,
        asset.created_at
          AS asset_created_at

      FROM users.memories memory

      INNER JOIN media.assets asset
        ON asset.id =
          memory.asset_id

        AND asset.uploaded_by =
          memory.user_id

        AND asset.deleted_at
          IS NULL

      WHERE memory.user_id =
          $1::uuid

        ${cursorCondition}

      ORDER BY
        memory.created_at DESC,
        memory.id DESC

      LIMIT $${limitParameterIndex}
    `;

    const { rows } = await Database.query(
      sql,
      params,
    );

    const hasMore =
      rows.length > safeLimit;

    const paginatedRows =
      hasMore
        ? rows.slice(
            0,
            safeLimit,
          )
        : rows;

    const lastRow =
      paginatedRows.at(-1) ??
      null;

    return {
      rows:
        paginatedRows,

      hasMore,

      lastRow,
    };
  }
}

export default new MemoriesRepository();