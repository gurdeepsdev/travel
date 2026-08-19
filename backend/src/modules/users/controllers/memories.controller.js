import Response from "../../../core/response/index.js";

import MemoriesService from "../services/memories.service.js";

class MemoriesController {
  /**
   * Saves an owned media asset as a private memory.
   */
  async saveMemory(
    req,
    res,
    next,
  ) {
    try {
      const {
        assetId,
        memoryType,
      } = req.validated.body;

      const result =
        await MemoriesService
          .saveMemory({
            userId:
              req.user.id,

            assetId,
            memoryType,

            memoryFile:
              req.file ?? null,

            logger:
              req.logger ?? null,
          });

      return Response.created(
        res,
        result,
        "Memory saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Returns only the authenticated user's memories.
   */
  async getMyMemories(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await MemoriesService
          .getMyMemories({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Memories fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new MemoriesController();
