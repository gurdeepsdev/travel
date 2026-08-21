import ExploreRepository
  from "../repositories/explore.repository.js";

import ExploreMapper
  from "../mappers/explore.mapper.js";

import PostsRepository
  from "../../users/repositories/posts.repository.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

class ExploreService {
  async getCountries({
    limit = 10,
  } = {}) {
    const countryRows =
      await ExploreRepository
        .listPopularCountries({
          limit,
        });

    return {
      countries: countryRows
        .map(
          (row) =>
            ExploreMapper.toCountry(
              row,
            ),
        )
        .filter(Boolean),
    };
  }

  async getCities({
    category = "FOR_YOU",
    limit = 10,
    viewerUserId = null,
  } = {}) {
    const cityRows =
      await ExploreRepository
        .listPopularCities({
          category,
          limit,
          viewerUserId,
        });

    return {
      cities:
        cityRows
          .map(
            (row) =>
              ExploreMapper
                .toCity(
                  row,
                  {
                    includeViewerState:
                      true,
                  },
                ),
          )
          .filter(
            Boolean,
          ),
    };
  }

  async getCityPlaces({
    cityId,
    limit = 20,
  }) {
    const placeRows =
      await ExploreRepository
        .listPlaces({
          cityId,
          limit,

          latitude:
            null,

          longitude:
            null,
        });

    return {
      cityId,

      places:
        placeRows
          .map(
            (row) =>
              ExploreMapper
                .toPlace(
                  row,
                ),
          )
          .filter(
            Boolean,
          ),
    };
  }

  async getPlaces({
    latitude = null,
    longitude = null,
    radiusKm = 50,
    limit = 10,
  } = {}) {
    const placeRows =
      await ExploreRepository
        .listPlaces({
          latitude,
          longitude,
          radiusKm,
          limit,
        });

    return {
      locationApplied:
        latitude !== null &&
        longitude !== null,

      places:
        placeRows
          .map(
            (row) =>
              ExploreMapper
                .toPlace(
                  row,
                ),
          )
          .filter(
            Boolean,
          ),
    };
  }

  async getFeed({
    viewerUserId = null,
    latitude = null,
    longitude = null,
    radiusKm = 50,
    limit = 20,
    cursor = null,
  }) {
    const isAuthenticated =
      Boolean(
        viewerUserId,
      );

    const effectiveLimit =
      isAuthenticated
        ? Math.min(
            Math.max(
              Number(limit) || 20,
              1,
            ),
            50,
          )
        : 20;

    const decodedCursor =
      isAuthenticated
        ? decodeCursor(
            cursor,
          )
        : null;

    const includeDiscoveryModules =
      decodedCursor ===
      null;

    const [
      postResult,
      cityRows,
      placeRows,
    ] =
      await Promise.all([
        ExploreRepository
          .listFeedPostIds({
            viewerUserId,
            limit:
              effectiveLimit,
            cursor:
              decodedCursor,
          }),

        includeDiscoveryModules
          ? ExploreRepository
              .listPopularCities({
                limit:
                  10,
              })
          : Promise.resolve(
              [],
            ),

        includeDiscoveryModules
          ? ExploreRepository
              .listPlaces({
                latitude,
                longitude,
                radiusKm,
                limit:
                  10,
              })
          : Promise.resolve(
              [],
            ),
      ]);

    const posts =
      await PostsRepository
        .getPostsByIds({
          postIds:
            postResult.rows.map(
              (row) =>
                row.id,
            ),

          viewerUserId,
        });

    const hasMore =
      isAuthenticated &&
      postResult.hasMore ===
        true;

    const lastRow =
      postResult.lastRow;

    const nextCursor =
      hasMore &&
      lastRow
        ? encodeCursor({
            createdAt:
              lastRow
                .cursor_created_at ??
              lastRow
                .created_at,

            id:
              lastRow.id,
          })
        : null;

    return ExploreMapper
      .toFeedResponse({
        cityRows,
        placeRows,
        posts,

        includeDiscoveryModules,

        hasMore,
        nextCursor,
      });
  }
}

export default new ExploreService();
