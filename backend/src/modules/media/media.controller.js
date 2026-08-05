import MediaService from "./media.service.js";

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

      return res.sendFile(
        filePath,
        (error) => {
          if (error) {
            return next(error);
          }

          return undefined;
        },
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new MediaController();