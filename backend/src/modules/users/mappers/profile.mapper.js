class ProfileMapper {
  toResponse(profile) {
    return {
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,

      profilePhoto: this.#mapMedia(profile, "profile_photo"),
      coverPhoto: this.#mapMedia(profile, "cover_photo"),

      country: this.#mapCountry(profile),
      city: this.#mapCity(profile),

      socialLinks: this.#mapSocialLinks(profile.social_links),

      isVerified: Boolean(profile.is_verified),
      isProfileCompleted: profile.profile_completed_at !== null,
      profileCompletedAt: profile.profile_completed_at,

      stats: {
        connections: this.#toNonNegativeInteger(profile.connections_count),
        posts: this.#toNonNegativeInteger(profile.posts_count),
        groups: this.#toNonNegativeInteger(profile.groups_count),
        savedItems: this.#toNonNegativeInteger(profile.saved_items_count),
        visitedPlaces: this.#toNonNegativeInteger(profile.visited_places_count),
      },

      preferredVisitedCollections: this.#mapPreferredVisitedCollections(
        profile.preferred_visited_collections,
      ),

      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  toPublicResponse(profile) {
    return {
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,

      profilePhoto: this.#mapMedia(profile, "profile_photo"),
      coverPhoto: this.#mapMedia(profile, "cover_photo"),

      country: this.#mapCountry(profile),
      city: this.#mapCity(profile),

      socialLinks: this.#mapSocialLinks(profile.social_links),

      isVerified: Boolean(profile.is_verified),

      stats: {
        connections: this.#toNonNegativeInteger(profile.connections_count),
        posts: this.#toNonNegativeInteger(profile.posts_count),
        groups: this.#toNonNegativeInteger(profile.groups_count),
        visitedPlaces: this.#toNonNegativeInteger(profile.visited_places_count),
      },

      preferredVisitedCollections: this.#mapPreferredVisitedCollections(
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
      name: profile.country_name,
      code: profile.country_code,
    };
  }

  #mapCity(profile) {
    if (!profile.city_id) {
      return null;
    }

    return {
      id: profile.city_id,
      name: profile.city_name,
      officialName: profile.city_official_name,
      countryId: profile.city_country_id,
    };
  }

  #mapMedia(profile, prefix) {
    const assetId = profile[`${prefix}_asset_id`];

    if (!assetId) {
      return null;
    }

    const variantId = profile[`${prefix}_variant_id`];

    return {
      assetId,
      mimeType: profile[`${prefix}_mime_type`],
      width: profile[`${prefix}_original_width`],
      height: profile[`${prefix}_original_height`],

      variant: variantId
        ? {
            id: variantId,
            name: profile[`${prefix}_variant_name`],
            format: profile[`${prefix}_variant_format`],
            quality: profile[`${prefix}_variant_quality`],
            width: profile[`${prefix}_variant_width`],
            height: profile[`${prefix}_variant_height`],
          }
        : null,
    };
  }

  #mapPreferredVisitedCollections(collections) {
    if (!Array.isArray(collections)) {
      return [];
    }

    return collections
      .filter(
        (collection) =>
          collection &&
          typeof collection === "object" &&
          !Array.isArray(collection),
      )
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        visitedAt: collection.visitedAt ?? null,
        verificationStatus: Boolean(collection.verificationStatus),
        iconAssetId: collection.iconAssetId ?? null,
        verificationAssetId: collection.verificationAssetId ?? null,

        places: Array.isArray(collection.places)
          ? collection.places
              .filter(
                (place) =>
                  place && typeof place === "object" && !Array.isArray(place),
              )
              .map((place) => ({
                id: place.id,
                name: place.name,
              }))
          : [],
      }));
  }

  #mapSocialLinks(socialLinks) {
    if (
      !socialLinks ||
      typeof socialLinks !== "object" ||
      Array.isArray(socialLinks)
    ) {
      return {};
    }

    return socialLinks;
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
