import {
  dirname,
} from "node:path";

import {
  resolveStoragePath,
} from "../../providers/storage/local.provider.js";
import VideoObjectStorageProvider
  from "../../providers/storage/video-object-storage.provider.js";
import VideoProcessingRepository
  from "./video-processing.repository.js";
import VideoProcessingService
  from "./video-processing.service.js";

function buildTranscodeDescriptor(
  asset,
) {
  return {
    outputPath:
      resolveStoragePath(
        asset.storage_key,
      ),
    outputStorageKey:
      asset.storage_key,
    thumbnailPath:
      resolveStoragePath(
        asset.thumbnail_storage_key,
      ),
    thumbnailStorageKey:
      asset.thumbnail_storage_key,
    hlsDirectory:
      dirname(
        resolveStoragePath(
          asset.hls_manifest_storage_key,
        ),
      ),
    hlsManifestStorageKey:
      asset.hls_manifest_storage_key,
  };
}

class VideoStorageSyncService {
  async sync(assetId) {
    if (
      !VideoObjectStorageProvider.enabled
    ) {
      return { skipped: true };
    }

    const asset =
      await VideoProcessingRepository
        .findStorageSyncAsset(
          assetId,
        );

    if (!asset) {
      return { skipped: true };
    }

    if (
      asset.is_public === true &&
      asset.storage_provider ===
        "local" &&
      (
        !asset.thumbnail_storage_key ||
        !asset.hls_manifest_storage_key
      )
    ) {
      const marked =
        await VideoProcessingRepository
          .markForReprocessing(
            assetId,
          );

      if (!marked) {
        return {
          skipped: false,
          action: "STALE",
        };
      }

      await VideoProcessingService
        .process(assetId);

      return {
        skipped: false,
        action: "REPROCESSED",
      };
    }

    if (
      !asset.thumbnail_storage_key ||
      !asset.hls_manifest_storage_key
    ) {
      return { skipped: true };
    }

    const descriptor =
      buildTranscodeDescriptor(asset);

    if (
      asset.is_public === true &&
      asset.storage_provider === "local"
    ) {
      const published =
        await VideoObjectStorageProvider
          .publishTranscode(
            descriptor,
          );

      const updated =
        await VideoProcessingRepository
          .markStorageProvider({
            assetId,
            expectedIsPublic: true,
            expectedStorageProvider:
              "local",
            storageProvider:
              published.storageProvider,
            bucket:
              published.bucket,
          });

      if (!updated) {
        await VideoObjectStorageProvider
          .removeMany(
            published.uploadedKeys,
          );
      }

      return {
        skipped: false,
        action: updated
          ? "PUBLISHED"
          : "STALE",
      };
    }

    if (
      asset.is_public === false &&
      asset.storage_provider ===
        VideoObjectStorageProvider.name
    ) {
      await VideoObjectStorageProvider
        .removeTranscode(
          descriptor,
        );

      const updated =
        await VideoProcessingRepository
          .markStorageProvider({
            assetId,
            expectedIsPublic: false,
            expectedStorageProvider:
              asset.storage_provider,
            storageProvider: "local",
            bucket: "local",
          });

      return {
        skipped: false,
        action: updated
          ? "WITHDRAWN"
          : "STALE",
      };
    }

    return { skipped: true };
  }
}

export {
  buildTranscodeDescriptor,
};

export default new VideoStorageSyncService();
