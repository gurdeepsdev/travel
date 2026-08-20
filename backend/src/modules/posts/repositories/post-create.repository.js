class PostCreateRepository {
  async findEligiblePlace({
    client,
    placeId,
    googleCityPlaceId = null,
  }) {
    const {
      rows,
    } = await client.query(
      `
        SELECT
          place.id,
          place.name,
          place.is_closed,
          place.city_id

        FROM poi.places place

        INNER JOIN poi.cities city
          ON city.id = place.city_id

        WHERE place.id = $1
          AND place.is_closed
            IS FALSE
          AND (
            $2::varchar IS NULL
            OR (
              city.provider =
                'GOOGLE_PLACES'
              AND city.provider_id =
                $2
            )
          )

        LIMIT 1

        FOR KEY SHARE
      `,
      [
        placeId,
        googleCityPlaceId,
      ],
    );

    return rows[0] ?? null;
  }

  async findEligibleGooglePlace({
    client,
    googlePlaceId,
    googleCityPlaceId = null,
  }) {
    const {
      rows,
    } = await client.query(
      `
        SELECT
          place.id,
          place.name,
          place.is_closed,
          place.provider,
          place.provider_id,
          place.city_id

        FROM poi.places place

        INNER JOIN poi.cities city
          ON city.id = place.city_id

        WHERE place.provider =
            'GOOGLE_PLACES'
          AND place.provider_id =
            $1
          AND place.is_closed
            IS FALSE
          AND (
            $2::varchar IS NULL
            OR (
              city.provider =
                'GOOGLE_PLACES'
              AND city.provider_id =
                $2
            )
          )

        LIMIT 1

        FOR KEY SHARE
      `,
      [
        googlePlaceId,
        googleCityPlaceId,
      ],
    );

    return rows[0] ?? null;
  }

  async findOwnedItineraries({
    client,
    userId,
    itineraryIds,
    postVisibility,
  }) {
    const normalizedIds =
      Array.isArray(itineraryIds)
        ? itineraryIds
        : [];

    if (
      normalizedIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        SELECT
          itinerary.id,
          itinerary.created_by,
          itinerary.visibility,
          itinerary.trip_status

        FROM itinerary.itineraries
          itinerary

        WHERE itinerary.id =
            ANY($1::uuid[])
          AND itinerary.created_by =
            $2
          AND itinerary.deleted_at
            IS NULL
          AND LOWER(
            itinerary.trip_status
          ) NOT IN (
            'cancelled',
            'archived'
          )
          AND (
            $3::text <> 'PUBLIC'
            OR LOWER(
              itinerary.visibility
            ) = 'public'
          )

        FOR KEY SHARE
      `,
      [
        normalizedIds,
        userId,
        postVisibility,
      ],
    );

    return rows;
  }

  async findTaggableUsers({
    client,
    userId,
    taggedUserIds,
  }) {
    const normalizedIds =
      Array.isArray(taggedUserIds)
        ? taggedUserIds
        : [];

    if (
      normalizedIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        SELECT
          tagged_user.id,
          tagged_profile.username

        FROM auth.users tagged_user

        INNER JOIN users.profiles
          tagged_profile
          ON tagged_profile.user_id =
            tagged_user.id
          AND tagged_profile.deleted_at
            IS NULL

        WHERE tagged_user.id =
            ANY($1::uuid[])
          AND tagged_user.id <> $2
          AND UPPER(
            tagged_user.status
          ) = 'ACTIVE'

          AND NOT EXISTS (
            SELECT 1
            FROM users.blocked_users
              blocked

            WHERE (
              blocked.user_id = $2
              AND blocked.blocked_user_id =
                tagged_user.id
            )
            OR (
              blocked.user_id =
                tagged_user.id
              AND blocked.blocked_user_id =
                $2
            )
          )

        FOR KEY SHARE OF
          tagged_user,
          tagged_profile
      `,
      [
        normalizedIds,
        userId,
      ],
    );

    return rows;
  }

  async insertPost({
    client,
    userId,
    caption,
    visibility,
    placeId,
  }) {
    const {
      rows,
    } = await client.query(
      `
        INSERT INTO explore.posts (
          user_id,
          caption,
          post_type,
          visibility,
          place_id
        )
        VALUES (
          $1,
          $2,
          'PLACE',
          $3,
          $4
        )
        RETURNING
          id,
          user_id,
          caption,
          post_type,
          visibility,
          place_id,
          comment_count,
          share_count,
          view_count,
          created_at,
          updated_at
      `,
      [
        userId,
        caption ?? null,
        visibility,
        placeId,
      ],
    );

    return rows[0];
  }

  async insertPostAssets({
    client,
    postId,
    assetIds,
  }) {
    const normalizedIds =
      Array.isArray(assetIds)
        ? assetIds
        : [];

    if (
      normalizedIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        INSERT INTO explore.post_assets (
          post_id,
          asset_id,
          display_order
        )

        SELECT
          $1,
          ordered_asset.asset_id,
          ordered_asset.ordinality - 1

        FROM UNNEST(
          $2::uuid[]
        ) WITH ORDINALITY
          AS ordered_asset(
            asset_id,
            ordinality
          )

        RETURNING
          id,
          post_id,
          asset_id,
          display_order,
          created_at
      `,
      [
        postId,
        normalizedIds,
      ],
    );

    return rows;
  }

  async insertPostItineraries({
    client,
    postId,
    itineraryIds,
  }) {
    const normalizedIds =
      Array.isArray(itineraryIds)
        ? itineraryIds
        : [];

    if (
      normalizedIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        INSERT INTO
          explore.post_itineraries (
            post_id,
            itinerary_id
          )

        SELECT
          $1,
          itinerary_id

        FROM UNNEST(
          $2::uuid[]
        ) AS itinerary_id

        RETURNING
          id,
          post_id,
          itinerary_id,
          created_at
      `,
      [
        postId,
        normalizedIds,
      ],
    );

    return rows;
  }

  async insertTaggedUsers({
    client,
    postId,
    userId,
    taggedUserIds,
  }) {
    const normalizedIds =
      Array.isArray(taggedUserIds)
        ? taggedUserIds
        : [];

    if (
      normalizedIds.length ===
      0
    ) {
      return [];
    }

    const {
      rows,
    } = await client.query(
      `
        INSERT INTO
          explore.post_tagged_users (
            post_id,
            tagged_user_id,
            tagged_by
          )

        SELECT
          $1,
          tagged_user_id,
          $2

        FROM UNNEST(
          $3::uuid[]
        ) AS tagged_user_id

        RETURNING
          id,
          post_id,
          tagged_user_id,
          tagged_by,
          created_at
      `,
      [
        postId,
        userId,
        normalizedIds,
      ],
    );

    return rows;
  }
}

export default new PostCreateRepository();
