import VideoProcessingRepository
  from "./video-processing.repository.js";

import {
  finalizeTranscode,
  rollbackTranscode,
  transcodeLocalVideo,
} from "./video-transcoder.js";

class VideoProcessingService {
  async process(
    assetId,
  ) {
    const asset =
      await VideoProcessingRepository
        .findProcessableAsset(
          assetId,
        );

    if (!asset) {
      return {
        skipped:
          true,
      };
    }

    if (
      asset.storage_provider !==
        "local"
    ) {
      throw new Error(
        `Video storage provider "${asset.storage_provider}" is not supported by this worker.`,
      );
    }

    const result =
      await transcodeLocalVideo({
        assetId:
          asset.id,

        storageKey:
          asset.storage_key,
      });

    try {
      await VideoProcessingRepository
        .markReady({
          assetId:
            asset.id,

          storageKey:
            result.outputStorageKey,

          fileSize:
            result.fileSize,

          width:
            result.width,

          height:
            result.height,

          durationSeconds:
            result.durationSeconds,

          thumbnailStorageKey:
            result.thumbnailStorageKey,

          thumbnailFileSize:
            result.thumbnailFileSize,

          thumbnailWidth:
            result.thumbnailWidth,

          thumbnailHeight:
            result.thumbnailHeight,
        });
    } catch (error) {
      await rollbackTranscode(
        result,
      );

      throw error;
    }

    await finalizeTranscode(
      result,
    );

    return {
      skipped:
        false,

      assetId:
        asset.id,

      storageKey:
        result.outputStorageKey,
    };
  }
}

export default new VideoProcessingService();
