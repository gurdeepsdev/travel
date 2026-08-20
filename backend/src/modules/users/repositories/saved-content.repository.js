import Database from "../../../database/database-manager.js";

class SavedContentRepository {
  /**
   * Returns active saved-post references that remain
   * accessible to the authenticated owner.
   *
   * Full post hydration is performed separately in
   * one batch query.
   */
  async listMySavedPostReferences({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit = Math.min(
      Math.max(Number(limit) || 20, 1),
      50,
    );

    const params = [userId];

    let cursorCondition = "";

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.id);

      cursorCondition = `
        AND (
          saved_item.created_at,
          saved_item.id
        ) < (
          $2::timestamp,
          $3::uuid
        )
      `;
    }

    params.push(safeLimit + 1);

    const limitParameterIndex =
      params.length;

    const sql = `
      SELECT
        saved_item.id
          AS saved_item_id,

        saved_item.created_at
          AS saved_at,

        saved_item.created_at::text
          AS cursor_created_at,

        post.id
          AS post_id

      FROM users.saved_items saved_item

      INNER JOIN explore.posts post
        ON saved_item.item_type = 'POST'
        AND post.id = saved_item.item_id
        AND post.deleted_at IS NULL

      LEFT JOIN users.profiles owner_profile
        ON owner_profile.user_id =
          post.user_id
        AND owner_profile.deleted_at
          IS NULL

      WHERE saved_item.user_id =
          $1::uuid

        AND saved_item.item_type =
          'POST'

        AND saved_item.is_active
          IS TRUE

        AND (
          post.user_id = $1::uuid

          OR (
            UPPER(post.visibility) =
              'PUBLIC'

            AND COALESCE(
              owner_profile.is_private,
              FALSE
            ) IS FALSE

            AND NOT EXISTS (
              SELECT 1
              FROM users.blocked_users blocked
              WHERE (
                blocked.user_id = $1::uuid
                AND blocked.blocked_user_id =
                  post.user_id
              )
              OR (
                blocked.user_id =
                  post.user_id
                AND blocked.blocked_user_id =
                  $1::uuid
              )
            )
          )
        )

        ${cursorCondition}

      ORDER BY
        saved_item.created_at DESC,
        saved_item.id DESC

      LIMIT $${limitParameterIndex}
    `;

    const { rows } = await Database.query(
      sql,
      params,
    );

    const hasMore =
      rows.length > safeLimit;

    const paginatedRows = hasMore
      ? rows.slice(0, safeLimit)
      : rows;

    const lastRow =
      paginatedRows.at(-1) ?? null;

    return {
      rows: paginatedRows,
      hasMore,
      lastRow,
    };
  }

    /**
   * Returns the target profile and its visibility
   * relationship with the current viewer.
   */
  async findProfileAccessContext({
    username,
    viewerUserId = null,
  }) {
    const sql = `
      SELECT
        profile.user_id,
        profile.username,
        profile.is_private,

        (
          $2::uuid IS NOT NULL
          AND profile.user_id =
            $2::uuid
        ) AS viewer_is_owner,

        CASE
          WHEN $2::uuid IS NULL
          THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM users.blocked_users blocked
            WHERE (
              blocked.user_id =
                $2::uuid
              AND blocked.blocked_user_id =
                profile.user_id
            )
            OR (
              blocked.user_id =
                profile.user_id
              AND blocked.blocked_user_id =
                $2::uuid
            )
          )
        END AS has_block_relationship

      FROM users.profiles profile

      WHERE LOWER(profile.username) =
          LOWER($1::varchar)

        AND profile.deleted_at IS NULL

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        username,
        viewerUserId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Returns deduplicated POI cards derived from
   * a user's active saved posts.
   *
   * No source-post identifiers or content are
   * selected.
   */
  async listUserSavedPlaces({
    targetUserId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit = Math.min(
      Math.max(Number(limit) || 20, 1),
      50,
    );

    const params = [targetUserId];

    let cursorCondition = "";

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.id);

      cursorCondition = `
        AND (
          deduplicated.saved_at,
          deduplicated.saved_item_id
        ) < (
          $2::timestamp,
          $3::uuid
        )
      `;
    }

    params.push(safeLimit + 1);

    const limitParameterIndex =
      params.length;

    const sql = `
      WITH ranked_saved_places AS (
        SELECT
          saved_item.id
            AS saved_item_id,

          saved_item.created_at
            AS saved_at,

          post.place_id,

          ROW_NUMBER() OVER (
            PARTITION BY post.place_id
            ORDER BY
              saved_item.created_at DESC,
              saved_item.id DESC
          ) AS place_rank

        FROM users.saved_items saved_item

        INNER JOIN explore.posts post
          ON saved_item.item_type =
            'POST'
          AND post.id =
            saved_item.item_id
          AND post.deleted_at IS NULL

        LEFT JOIN users.profiles
          source_owner_profile
          ON source_owner_profile.user_id =
            post.user_id
          AND source_owner_profile.deleted_at
            IS NULL

        WHERE saved_item.user_id =
            $1::uuid

          AND saved_item.item_type =
            'POST'

          AND saved_item.is_active
            IS TRUE

          /*
           * Public saved places must not reveal
           * locations derived from inaccessible
           * source posts.
           */
          AND UPPER(post.visibility) =
            'PUBLIC'

          AND COALESCE(
            source_owner_profile.is_private,
            FALSE
          ) IS FALSE

          AND NOT EXISTS (
            SELECT 1
            FROM users.blocked_users blocked
            WHERE (
              blocked.user_id =
                $1::uuid
              AND blocked.blocked_user_id =
                post.user_id
            )
            OR (
              blocked.user_id =
                post.user_id
              AND blocked.blocked_user_id =
                $1::uuid
            )
          )
      ),

      deduplicated AS (
        SELECT
          ranked.saved_item_id,
          ranked.saved_at,
          ranked.place_id

        FROM ranked_saved_places ranked

        WHERE ranked.place_rank = 1
      )

      SELECT
        deduplicated.saved_item_id,
        deduplicated.saved_at,

        deduplicated.saved_at::text
          AS cursor_created_at,

        place.id,
        place.name,
        place.description,
        place.address,
        place.latitude,
        place.longitude,
        place.rating,
        place.review_count,
        place.is_verified,
        place.is_closed,

        place_image.id
          AS image_id,
        place_image.storage_provider
          AS image_storage_provider,
        place_image.bucket
          AS image_bucket,
        place_image.storage_key
          AS image_storage_key,
        place_image.mime_type
          AS image_mime_type

      FROM deduplicated

      INNER JOIN poi.places place
        ON place.id =
          deduplicated.place_id

      LEFT JOIN media.assets place_image
        ON place_image.id =
          place.media_id
        AND place_image.deleted_at
          IS NULL
        AND place_image.is_public
          IS TRUE

      WHERE TRUE

        ${cursorCondition}

      ORDER BY
        deduplicated.saved_at DESC,
        deduplicated.saved_item_id DESC

      LIMIT $${limitParameterIndex}
    `;

    const { rows } = await Database.query(
      sql,
      params,
    );

    const hasMore =
      rows.length > safeLimit;

    const paginatedRows = hasMore
      ? rows.slice(0, safeLimit)
      : rows;

    const lastRow =
      paginatedRows.at(-1) ?? null;

    return {
      rows: paginatedRows,
      hasMore,
      lastRow,
    };
  }
}

export default new SavedContentRepository();
