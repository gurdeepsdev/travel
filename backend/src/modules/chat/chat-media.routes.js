import { z } from "zod";
import validate from "../../middleware/validate.middleware.js";
import { attachmentResourceSchema } from "./chat.validation.js";
import Messages from "./chat-messages.service.js";
import { getChatPreview } from "./chat-media.service.js";

export function registerChatMediaRoutes(router) {
  const base = "/conversations/:conversationId/messages/:messageId/attachments/:assetId/preview";
  const deliver = (resource) => async (req, res, next) => {
    try {
      const p = req.validated.params;
      await Messages.attachment(req.user.id, p.conversationId, p.messageId, p.assetId);
      const asset = await getChatPreview(p.assetId, resource(p));
      res.set({ "Cache-Control": "private, no-store", "Content-Type": asset.mimeType,
        "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" });
      res.sendFile(asset.filePath, error => { if (error) next(error); });
    } catch (error) { next(error); }
  };
  router.get(`${base}/images/:size`, validate(attachmentResourceSchema.extend({
    params: attachmentResourceSchema.shape.params.extend({size:z.enum(["320","640","1080","1600"])}),
  })), deliver(p => ({kind:"image",size:Number(p.size)})));
  for (const [suffix,kind] of [["thumbnail","thumbnail"],["video.mp4","video"],["stream/master.m3u8","master"]]) {
    router.get(`${base}/${suffix}`, validate(attachmentResourceSchema), deliver(() => ({kind})));
  }
  router.get(`${base}/stream/:rendition/:fileName`, validate(attachmentResourceSchema.extend({
    params: attachmentResourceSchema.shape.params.extend({
      rendition:z.enum(["360p","540p","720p","1080p"]),
      fileName:z.string().regex(/^(index\.m3u8|segment_\d+\.ts)$/),
    }),
  })), deliver(p => ({kind:"segment",rendition:p.rendition,fileName:p.fileName})));
}
