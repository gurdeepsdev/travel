import MediaService from "./media.service.js";
import mediaDelivery from "../../config/media-delivery.js";

function buildInternalRedirect(
  storageKey,
) {
  const encodedStorageKey =
    String(storageKey)
      .split("/")
      .map((segment) =>
        encodeURIComponent(segment),
      )
      .join("/");

  return `${mediaDelivery.internalPrefix}/${encodedStorageKey}`;
}

function deliverLocalFile({
  res,
  next,
  filePath,
  storageKey,
}) {
  if (mediaDelivery.xAccelEnabled) {
    res.set(
      "X-Accel-Redirect",
      buildInternalRedirect(
        storageKey,
      ),
    );

    return res.status(200).end();
  }

  return res.sendFile(
    filePath,
    (error) => error
      ? next(error)
      : undefined,
  );
}

class MediaController {
  /**
   * Delivers a local asset after public/owner
   * access has been confirmed.
   */
  async getAssetContent(
    req,
    res,
    next,
  ) {
    try {
      const {
        assetId,
      } = req.validated.params;

      const {
        asset,
        filePath,
        storageKey,
        cacheControl,
      } = await MediaService
        .getLocalAssetContent({
          assetId,

          viewerUserId:
            req.user?.id ??
            null,
        });

      res.set({
        "Cache-Control":
          cacheControl,

        "Content-Type":
          asset.mime_type,

        "Content-Disposition":
          "inline",
      });

      return deliverLocalFile({
        res,
        next,
        filePath,
        storageKey,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAssetThumbnail(
    req,
    res,
    next,
  ) {
    try {
      const { assetId } =
        req.validated.params;

      const {
        filePath,
        storageKey,
        cacheControl,
      } = await MediaService
        .getLocalAssetThumbnail({
          assetId,
          viewerUserId:
            req.user?.id ?? null,
        });

      res.set({
        "Cache-Control":
          cacheControl,
        "Content-Type":
          "image/jpeg",
        "Content-Disposition":
          "inline",
      });

      return deliverLocalFile({
        res,
        next,
        filePath,
        storageKey,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAssetStreamManifest(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await MediaService
          .getLocalAssetStreamResource({
            assetId:
              req.validated.params
                .assetId,
            viewerUserId:
              req.user?.id ?? null,
          });

      res.set({
        "Cache-Control":
          result.cacheControl,
        "Content-Type":
          result.contentType,
        "Content-Disposition":
          "inline",
      });

      return deliverLocalFile({
        res,
        next,
        filePath:
          result.filePath,
        storageKey:
          result.storageKey,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAssetStreamResource(
    req,
    res,
    next,
  ) {
    try {
      const {
        assetId,
        rendition,
        fileName,
      } = req.validated.params;

      const result =
        await MediaService
          .getLocalAssetStreamResource({
            assetId,
            viewerUserId:
              req.user?.id ?? null,
            rendition,
            fileName,
          });

      res.set({
        "Cache-Control":
          result.cacheControl,
        "Content-Type":
          result.contentType,
        "Content-Disposition":
          "inline",
      });

      return deliverLocalFile({
        res,
        next,
        filePath:
          result.filePath,
        storageKey:
          result.storageKey,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new MediaController();

export {
  buildInternalRedirect,
  deliverLocalFile,
};
