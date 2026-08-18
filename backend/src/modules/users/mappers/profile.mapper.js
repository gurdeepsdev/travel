import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class ProfileMapper {
  toResponse(profile) {
    if (!profile) {
      return null;
    }

    return {
      userId: profile.user_id,
      username: profile.username ?? null,
            displayName: profile.display_name ?? null,
      bio: profile.bio ?? null,

      profilePhoto: this.#mapMedia(profile, "profile_photo"),

      // Your current DB does not contain cover_photo_asset_id.
      // This will automatically return null.
      coverPhoto: this.#mapMedia(profile, "cover_photo"),

      country: this.#mapCountry(profile),
      city: this.#mapCity(profile),

      // Your current DB does not contain social_links.
      // This will return an empty object.
      socialLinks: this.#mapSocialLinks(profile.social_links),

      isPrivate: Boolean(profile.is_private),
      isVerified: Boolean(profile.is_verified),

      isProfileCompleted: profile.profile_completed_at !== null,
      profileCompletedAt: profile.profile_completed_at ?? null,

      stats: {
        connections: this.#toNonNegativeInteger(
          profile.connections_count,
        ),
        posts: this.#toNonNegativeInteger(profile.posts_count),
        groups: this.#toNonNegativeInteger(profile.groups_count),
        savedItems: this.#toNonNegativeInteger(
          profile.saved_items_count,
        ),
        visitedPlaces: this.#toNonNegativeInteger(
          profile.visited_places_count,
        ),
      },

      preferredVisitedCollections:
        this.#mapPreferredVisitedCollections(
          profile.preferred_visited_collections,
        ),

      createdAt: profile.created_at ?? null,
      updatedAt: profile.updated_at ?? null,
    };
  }

  toPublicResponse(profile) {
    if (!profile) {
      return null;
    }

    return {
      userId: profile.user_id,
      username: profile.username ?? null,
            displayName: profile.display_name ?? null,
      bio: profile.bio ?? null,

      profilePhoto: this.#mapMedia(profile, "profile_photo"),
      coverPhoto: this.#mapMedia(profile, "cover_photo"),

      country: this.#mapCountry(profile),
      city: this.#mapCity(profile),

      socialLinks: this.#mapSocialLinks(profile.social_links),

      isPrivate: Boolean(profile.is_private),
      isVerified: Boolean(profile.is_verified),

           stats: {
        connections: this.#toNonNegativeInteger(
          profile.connections_count,
        ),

        posts: this.#toNonNegativeInteger(
          profile.posts_count,
        ),

        groups: this.#toNonNegativeInteger(
          profile.groups_count,
        ),

        savedItems: this.#toNonNegativeInteger(
          profile.saved_items_count,
        ),

        visitedPlaces: this.#toNonNegativeInteger(
          profile.visited_places_count,
        ),
      },

      preferredVisitedCollections:
        this.#mapPreferredVisitedCollections(
          profile.preferred_visited_collections,
        ),
    };
  }

  #mapCountry(profile) {
    if (!profile.country_id) {
      return null;
    }

    return {
      id: profile.country_id,
      name: profile.country_name ?? null,
      code: profile.country_code ?? null,
    };
  }

  #mapCity(profile) {
    if (!profile.city_id) {
      return null;
    }

    return {
      id: profile.city_id,
      name: profile.city_name ?? null,
      officialName: profile.city_official_name ?? null,
      countryId: profile.city_country_id ?? null,
    };
  }

  #mapMedia(profile, prefix) {
    const assetId = profile[`${prefix}_asset_id`];

    if (!assetId) {
      return null;
    }

    const variantId = profile[`${prefix}_variant_id`];
  const storageKey =
      profile[`${prefix}_storage_key`] ??
      profile[`${prefix}_original_storage_key`] ??
      null;
    return {
      assetId,

      type: profile[`${prefix}_type`] ?? null,
      storageKey,

      url:
        buildAssetUrl({
          assetId,

          storageProvider:
            profile[
              `${prefix}_storage_provider`
            ] ?? null,

          storageKey,

          isPublic:
            profile[
              `${prefix}_is_public`
            ] === true,
        }),

      originalFileName:
        profile[`${prefix}_original_file_name`] ?? null,

      extension:
        profile[`${prefix}_extension`] ?? null,

      fileSize:
        this.#toNullableNumber(
          profile[`${prefix}_file_size`],
        ),

      mimeType:
        profile[`${prefix}_mime_type`] ?? null,

      width:
        this.#toNullableNumber(
          profile[`${prefix}_original_width`],
        ),

      height:
        this.#toNullableNumber(
          profile[`${prefix}_original_height`],
        ),

      variant: variantId
        ? {
            id: variantId,
            name:
              profile[`${prefix}_variant_name`] ?? null,
            format:
              profile[`${prefix}_variant_format`] ?? null,
            quality:
              this.#toNullableNumber(
                profile[`${prefix}_variant_quality`],
              ),
            width:
              this.#toNullableNumber(
                profile[`${prefix}_variant_width`],
              ),
            height:
              this.#toNullableNumber(
                profile[`${prefix}_variant_height`],
              ),
          }
        : null,
    };
  }

 #mapPreferredVisitedCollections(
    collections,
  ) {
    if (!Array.isArray(collections)) {
      return [];
    }

    return collections
      .filter((collection) =>
        this.#isPlainObject(
          collection,
        ),
      )
      .map((collection) => {
        const icon =
          this.#isPlainObject(
            collection.icon,
          )
            ? collection.icon
            : null;

        const iconIsPublic =
          icon?.isPublic ===
            true;

        return {
          id:
            collection.id ??
            null,

          cityId:
            collection.cityId ??
            null,

          name:
            collection.name ??
            null,

          officialName:
            collection.officialName ??
            null,

          country:
            this.#isPlainObject(
              collection.country,
            )
              ? {
                  id:
                    collection
                      .country.id ??
                    null,

                  name:
                    collection
                      .country.name ??
                    null,
                }
              : null,

          visitedAt:
            collection.visitedAt ??
            null,

          verificationStatus:
            Boolean(
              collection
                .verificationStatus,
            ),

          icon:
            icon?.id
              ? {
                  id:
                    icon.id,

                  url:
                    buildAssetUrl({
                      assetId:
                        icon.id,

                      storageProvider:
                        icon
                          .storageProvider ??
                        null,

                      storageKey:
                        icon.storageKey ??
                        null,

                      isPublic:
                        iconIsPublic,
                    }),

                  mimeType:
                    icon.mimeType ??
                    null,
                }
              : null,

          places:
            Array.isArray(
              collection.places,
            )
              ? collection.places
                  .filter((place) =>
                    this.#isPlainObject(
                      place,
                    ),
                  )
                  .map((place) => ({
                    id:
                      place.id ??
                      null,

                    name:
                      place.name ??
                      null,

                    latitude:
                      this
                        .#toNullableNumber(
                          place.latitude,
                        ),

                    longitude:
                      this
                        .#toNullableNumber(
                          place.longitude,
                        ),

                    mediaAssetId:
                      place
                        .mediaAssetId ??
                      null,

                    visitedAt:
                      place.visitedAt ??
                      null,

                    verificationStatus:
                      place
                        .verificationStatus ??
                      null,

                    visitSource:
                      place.visitSource ??
                      null,
                  }))
              : [],
        };
      });
  }

  #mapSocialLinks(socialLinks) {
    if (!this.#isPlainObject(socialLinks)) {
      return {};
    }

    return socialLinks;
  }

  #isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  #toNullableNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  #toNonNegativeInteger(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }

    return Math.trunc(number);
  }
}

export default new ProfileMapper();
