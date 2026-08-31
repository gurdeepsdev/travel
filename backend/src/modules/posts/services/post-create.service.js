import Database from "../../../database/database-manager.js";

import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import StorageManager from "../../../providers/storage/storage-manager.js";

import {
  enqueueVideoAssets,
} from "../../media/video-processing.queue.js";

import MediaRepository from "../../media/media.repository.js";

import UserPostsRepository from "../../users/repositories/posts.repository.js";

import {
  MAX_POST_MEDIA_FILES,
} from "../middleware/post-media-upload.middleware.js";

import PostCreateRepository from "../repositories/post-create.repository.js";

import {
  inspectPostMediaFiles,
} from "../utils/post-media-file.util.js";

function createValidationError(
  message,
) {
  return new AppError({
    code:
      ErrorCodes.COMMON
        .VALIDATION_FAILED,

    message:
      "Validation failed.",

    statusCode:
      HttpStatus.BAD_REQUEST,

    details: {
      formErrors: [],

      fieldErrors: {
        body: [
          message,
        ],
      },
    },
  });
}

function createReferenceError({
  code,
  message,
}) {
  return new AppError({
    code,
    message,

    statusCode:
      HttpStatus.NOT_FOUND,

    details: null,
  });
}

function uniqueStorageObjects(
  objects,
) {
  const storageKeys =
    new Set();

  return (objects ?? [])
    .filter((object) => {
      const storageKey =
        object?.storageKey;

      if (
        !storageKey ||
        storageKeys.has(
          storageKey,
        )
      ) {
        return false;
      }

      storageKeys.add(
        storageKey,
      );

      return true;
    });
}

async function cleanupStorageObjects({
  objects,
  logger,
  logMessage,
}) {
  const uniqueObjects =
    uniqueStorageObjects(
      objects,
    );

  const results =
    await Promise.allSettled(
      uniqueObjects.map(
        (object) =>
          StorageManager.remove({
            storageKey:
              object.storageKey,
          }),
      ),
    );

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
        "rejected"
      ) {
        logger?.error(
          {
            storageKey:
              uniqueObjects[index]
                .storageKey,

            error: {
              name:
                result.reason?.name,

              message:
                result.reason
                  ?.message,

              stack:
                result.reason?.stack,
            },
          },
          logMessage,
        );
      }
    },
  );
}

function resolveOrderedAssetIds({
  existingAssetIds,
  uploadedAssets,
  mediaOrder,
}) {
  const existingIds =
    existingAssetIds ?? [];

  const uploaded =
    uploadedAssets ?? [];

  const order =
    mediaOrder ?? [];

  if (
    existingIds.length > 0 &&
    uploaded.length > 0 &&
    order.length === 0
  ) {
    throw createValidationError(
      "Media order is required when combining existing assets with uploaded files.",
    );
  }

  if (
    order.length === 0
  ) {
    return [
      ...existingIds,

      ...uploaded
        .sort(
          (
            first,
            second,
          ) =>
            first.fileIndex -
            second.fileIndex,
        )
        .map(
          (asset) =>
            asset.id,
        ),
    ];
  }

  const expectedItemCount =
    existingIds.length +
    uploaded.length;

  if (
    order.length !==
    expectedItemCount
  ) {
    throw createValidationError(
      "Media order must reference every existing asset and uploaded file exactly once.",
    );
  }

  const existingIdSet =
    new Set(
      existingIds,
    );

  const uploadedByIndex =
    new Map(
      uploaded.map(
        (asset) => [
          asset.fileIndex,
          asset,
        ],
      ),
    );

  const orderedAssetIds =
    order.map(
      (item) => {
        if (
          item.source ===
          "EXISTING"
        ) {
          if (
            !existingIdSet.has(
              item.assetId,
            )
          ) {
            throw createValidationError(
              "Media order contains an invalid existing asset reference.",
            );
          }

          return item.assetId;
        }

        const uploadedAsset =
          uploadedByIndex.get(
            item.fileIndex,
          );

        if (!uploadedAsset) {
          throw createValidationError(
            "Media order contains an invalid uploaded-file reference.",
          );
        }

        return uploadedAsset.id;
      },
    );

  if (
    new Set(
      orderedAssetIds,
    ).size !==
    orderedAssetIds.length
  ) {
    throw createValidationError(
      "The same media asset cannot be attached to a post more than once.",
    );
  }

  return orderedAssetIds;
}

class PostCreateService {
  async createPost({
    userId,
    caption,
    visibility,
    placeId,
    googleId,
    existingAssetIds,
    mediaOrder,
    itineraryIds,
    taggedUserIds,
    files,
    logger = null,
  }) {
    const normalizedFiles =
      Array.isArray(files)
        ? files
        : [];

    const normalizedExistingIds =
      existingAssetIds ?? [];

    const normalizedItineraryIds =
      itineraryIds ?? [];

    const normalizedTaggedUserIds =
      taggedUserIds ?? [];

    const totalRequestedMedia =
      normalizedFiles.length +
      normalizedExistingIds.length;

    if (
      totalRequestedMedia >
      MAX_POST_MEDIA_FILES
    ) {
      throw createValidationError(
        `A post cannot contain more than ${MAX_POST_MEDIA_FILES} media assets.`,
      );
    }

    if (
      totalRequestedMedia === 0 &&
      normalizedItineraryIds.length ===
        0
    ) {
      throw createValidationError(
        "At least one media asset or itinerary must be provided.",
      );
    }

    if (
      normalizedTaggedUserIds
        .includes(userId)
    ) {
      throw new AppError({
        code:
          ErrorCodes.POST
            .TAGGED_USER_NOT_ALLOWED,

        message:
          "A post author cannot tag themselves.",

        statusCode:
          HttpStatus.BAD_REQUEST,

        details: null,
      });
    }

    let inspectedFiles;

    try {
      inspectedFiles =
        await inspectPostMediaFiles(
          normalizedFiles,
        );
    } catch (error) {
      if (
        error instanceof
          AppError
      ) {
        throw error;
      }

      throw new AppError({
        code:
          ErrorCodes.POST
            .MEDIA_UPLOAD_FAILED,

        message:
          "Post media could not be inspected.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    const storedUploads = [];

    try {
      for (
        const inspectedFile of
        inspectedFiles
      ) {
        const stored =
          await StorageManager.store({
            temporaryPath:
              inspectedFile
                .temporaryPath,

            userId,

            extension:
              inspectedFile
                .extension,
          });

        storedUploads.push({
          ...inspectedFile,
          ...stored,
        });
      }
    } catch (error) {
      await cleanupStorageObjects({
        objects:
          storedUploads,

        logger,

        logMessage:
          "Failed to clean stored post media after an upload failure.",
      });

      throw new AppError({
        code:
          ErrorCodes.POST
            .MEDIA_UPLOAD_FAILED,

        message:
          "Post media could not be stored.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    let transactionResult;

    try {
      transactionResult =
        await Database.transaction(
          async (client) => {
            const location = placeId
              ? await PostCreateRepository
                  .findEligiblePlace({
                    client,
                    placeId,
                  })
              : await PostCreateRepository
                  .findEligibleGoogleLocation({
                    client,
                    googleId,
                  });

            if (!location) {
              throw createReferenceError({
                code:
                  ErrorCodes.POST
                    .PLACE_NOT_ALLOWED,

                message:
                  "Post location was not found or is not available.",
              });
            }

            const existingAssets =
              await MediaRepository
                .findOwnedPostAssets({
                  client,
                  userId,

                  assetIds:
                    normalizedExistingIds,
                });

            if (
              existingAssets.length !==
              normalizedExistingIds.length
            ) {
              throw createReferenceError({
                code:
                  ErrorCodes.POST
                    .ASSET_NOT_ALLOWED,

                message:
                  "A post asset was not found or is not allowed.",
              });
            }

            const itineraries =
              await PostCreateRepository
                .findOwnedItineraries({
                  client,
                  userId,

                  itineraryIds:
                    normalizedItineraryIds,

                  postVisibility:
                    visibility,
                });

            if (
              itineraries.length !==
              normalizedItineraryIds
                .length
            ) {
              throw createReferenceError({
                code:
                  ErrorCodes.POST
                    .ITINERARY_NOT_ALLOWED,

                message:
                  "A post itinerary was not found or is not allowed.",
              });
            }

            const taggedUsers =
              await PostCreateRepository
                .findTaggableUsers({
                  client,
                  userId,

                  taggedUserIds:
                    normalizedTaggedUserIds,
                });

            if (
              taggedUsers.length !==
              normalizedTaggedUserIds
                .length
            ) {
              throw createReferenceError({
                code:
                  ErrorCodes.POST
                    .TAGGED_USER_NOT_ALLOWED,

                message:
                  "A tagged user was not found or is not allowed.",
              });
            }

            const uploadedResolution =
              await MediaRepository
                .resolveUploadedAssets({
                  client,
                  userId,

                  isPublic:
                    visibility ===
                    "PUBLIC",

                  uploads:
                    storedUploads,
                });

            const orderedAssetIds =
              resolveOrderedAssetIds({
                existingAssetIds:
                  normalizedExistingIds,

                uploadedAssets:
                  uploadedResolution
                    .assets,

                mediaOrder,
              });

            if (
              visibility ===
                "PUBLIC" &&
              orderedAssetIds.length >
                0
            ) {
              await MediaRepository
                .makeAssetsPublic({
                  client,

                  assetIds:
                    orderedAssetIds,
                });
            }

            const post =
              await PostCreateRepository
                .insertPost({
                  client,
                  userId,
                  caption,
                  visibility,

                  placeId:
                    location.place_id,

                  cityId:
                    location.city_id,

                  postType:
                    location.target_type,
                });

            await PostCreateRepository
              .insertPostAssets({
                client,

                postId:
                  post.id,

                assetIds:
                  orderedAssetIds,
              });

            await PostCreateRepository
              .insertPostItineraries({
                client,

                postId:
                  post.id,

                itineraryIds:
                  normalizedItineraryIds,
              });

            await PostCreateRepository
              .insertTaggedUsers({
                client,

                postId:
                  post.id,

                userId,

                taggedUserIds:
                  normalizedTaggedUserIds,
              });

            return {
              postId:
                post.id,

              uploadedAssets:
                uploadedResolution
                  .assets,

              unusedStoredObjects:
                uploadedResolution
                  .unusedStoredObjects,

              supersededStoredObjects:
                uploadedResolution
                  .supersededStoredObjects,
            };
          },
        );
    } catch (error) {
      /*
       * The database transaction rolled back, so
       * every object uploaded by this request is
       * now unreferenced and must be removed.
       */
      await cleanupStorageObjects({
        objects:
          storedUploads,

        logger,

        logMessage:
          "Failed to compensate post media after post creation rollback.",
      });

      if (
        error instanceof
          AppError
      ) {
        throw error;
      }

      throw new AppError({
        code:
          ErrorCodes.POST
            .CREATE_FAILED,

        message:
          "Post could not be created.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    /*
     * These cleanups occur only after commit:
     * - duplicate newly uploaded objects;
     * - old object replaced while restoring a
     *   soft-deleted asset row.
     */
    await cleanupStorageObjects({
      objects: [
        ...transactionResult
          .unusedStoredObjects,

        ...transactionResult
          .supersededStoredObjects,
      ],

      logger,

      logMessage:
        "Failed to clean superseded post media after commit.",
    });

    try {
      await enqueueVideoAssets(
        transactionResult
          .uploadedAssets,
      );
    } catch (error) {
      logger?.error(
        {
          postId:
            transactionResult
              .postId,

          error: {
            name:
              error.name,

            message:
              error.message,

            stack:
              error.stack,
          },
        },
        "Failed to enqueue post video processing.",
      );
    }

    const createdPosts =
      await UserPostsRepository
        .getPostsByIds({
          postIds: [
            transactionResult
              .postId,
          ],

          viewerUserId:
            userId,
        });

    const createdPost =
      createdPosts[0] ??
      null;

    if (!createdPost) {
      throw new AppError({
        code:
          ErrorCodes.POST
            .CREATE_FAILED,

        message:
          "Post was created but could not be loaded.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: {
          postId:
            transactionResult
              .postId,
        },
      });
    }

    return {
      post:
        createdPost,
    };
  }
}

export {
  cleanupStorageObjects,
  resolveOrderedAssetIds,
};

export default new PostCreateService();
