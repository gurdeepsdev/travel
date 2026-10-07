import { Router } from "express";
import Inbox from "./chat-inbox.service.js";
import Push from "./chat-push.service.js";
import Events from "./chat-events.service.js";
import { requestMessageSchema, replaySchema } from "./chat.validation.js";
import {
  pushDeviceSchema,
  deletePushDeviceSchema,
  unreadSchema,
} from "./chat.validation.js";
import {
  inboxSchema,
  settingsSchema,
  readConversationSchema,
  reportMessageSchema,
} from "./chat.validation.js";
import Auth from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validate.middleware.js";
import Response from "../../core/response/index.js";
import Service from "./chat.service.js";
import Messages from "./chat-messages.service.js";
import { reactionSchema, receiptSchema } from "./chat.validation.js";
import {
  messageResourceSchema,
  attachmentResourceSchema,
} from "./chat.validation.js";
import { uploadChatAttachment } from "./chat-attachment-upload.js";
import {
  sendMessageSchema,
  messageHistorySchema,
  editMessageSchema,
  deleteMessageSchema,
} from "./chat.validation.js";
import {
  createConversationSchema,
  getConversationSchema,
  respondConversationSchema,
} from "./chat.validation.js";

const router = Router();
router.use(Auth.authenticate);
const handle = (action, message) => async (req, res, next) => {
  try {
    return Response.success(res, await action(req), message);
  } catch (error) {
    return next(error);
  }
};
router.get(
  "/events",
  validate(replaySchema),
  handle(
    (req) => Events.replay(req.user.id, req.validated.query),
    "Chat events fetched successfully.",
  ),
);
router.post(
  "/conversations/:conversationId/request-message",
  validate(requestMessageSchema),
  handle(
    (req) =>
      Messages.send(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.body,
        { requestMessage: true },
      ),
    "Initial request message saved successfully.",
  ),
);
router.post(
  "/conversations",
  validate(createConversationSchema),
  handle(
    (req) => Service.create(req.user.id, req.validated.body),
    "Conversation created or fetched successfully.",
  ),
);
router.get(
  "/conversations/:conversationId",
  validate(getConversationSchema),
  handle(
    (req) => Service.get(req.user.id, req.validated.params.conversationId),
    "Conversation fetched successfully.",
  ),
);
router.patch(
  "/conversations/:conversationId/request",
  validate(respondConversationSchema),
  handle(
    (req) =>
      Service.respond(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.body.status,
      ),
    "Message request response saved successfully.",
  ),
);
export default router;
router.get(
  "/conversations",
  validate(inboxSchema),
  handle(
    (req) => Inbox.list(req.user.id, req.validated.query),
    "Chat inbox fetched successfully.",
  ),
);
router.get(
  "/unread-count",
  validate(unreadSchema),
  handle(
    (req) => Inbox.unread(req.user.id),
    "Unread counts fetched successfully.",
  ),
);
router.put(
  "/push-devices",
  validate(pushDeviceSchema),
  handle(
    (req) => Push.register(req.user.id, req.session.id, req.validated.body),
    "Push device registered successfully.",
  ),
);
router.delete(
  "/push-devices/:deviceId",
  validate(deletePushDeviceSchema),
  handle(
    (req) => Push.remove(req.user.id, req.validated.params.deviceId),
    "Push device removed successfully.",
  ),
);
router.patch(
  "/conversations/:conversationId/settings",
  validate(settingsSchema),
  handle(
    (req) =>
      Inbox.settings(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.body,
      ),
    "Conversation preferences saved successfully.",
  ),
);
router.put(
  "/conversations/:conversationId/read",
  validate(readConversationSchema),
  handle(
    (req) =>
      Inbox.read(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.body.messageId,
      ),
    "Conversation read state saved successfully.",
  ),
);
router.post(
  "/conversations/:conversationId/messages/:messageId/reports",
  validate(reportMessageSchema),
  handle(
    (req) =>
      Inbox.report(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        req.validated.body,
      ),
    "Message report saved successfully.",
  ),
);
router.post(
  "/conversations/:conversationId/attachments",
  validate(getConversationSchema),
  uploadChatAttachment,
);
router.get(
  "/conversations/:conversationId/messages/:messageId/itinerary",
  validate(messageResourceSchema),
  handle(
    (req) =>
      Messages.itinerary(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
      ),
    "Shared itinerary fetched successfully.",
  ),
);
router.get(
  "/conversations/:conversationId/messages/:messageId/attachments/:assetId",
  validate(attachmentResourceSchema),
  async (req, res, next) => {
    try {
      const { conversationId, messageId, assetId } = req.validated.params;
      const asset = await Messages.attachment(
        req.user.id,
        conversationId,
        messageId,
        assetId,
      );
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Type": asset.mimeType,
        "Content-Disposition": "attachment",
        "X-Content-Type-Options": "nosniff",
      });
      return res.sendFile(asset.filePath, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  },
);
router.put(
  "/conversations/:conversationId/messages/:messageId/reactions",
  validate(reactionSchema),
  handle(
    (req) =>
      Messages.react(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        req.validated.body.reaction,
      ),
    "Reaction saved successfully.",
  ),
);
router.delete(
  "/conversations/:conversationId/messages/:messageId/reactions",
  validate(reactionSchema),
  handle(
    (req) =>
      Messages.react(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        req.validated.body.reaction,
        true,
      ),
    "Reaction removed successfully.",
  ),
);
router.put(
  "/conversations/:conversationId/messages/:messageId/receipt",
  validate(receiptSchema),
  handle(
    (req) =>
      Messages.receipt(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        req.validated.body.status,
      ),
    "Receipt saved successfully.",
  ),
);
router.post(
  "/conversations/:conversationId/messages",
  validate(sendMessageSchema),
  handle(
    (req) =>
      Messages.send(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.body,
      ),
    "Message saved successfully.",
  ),
);
router.get(
  "/conversations/:conversationId/messages",
  validate(messageHistorySchema),
  handle(
    (req) =>
      Messages.history(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.query,
      ),
    "Messages fetched successfully.",
  ),
);
router.patch(
  "/conversations/:conversationId/messages/:messageId",
  validate(editMessageSchema),
  handle(
    (req) =>
      Messages.mutate(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        "edit",
        req.validated.body,
      ),
    "Message edited successfully.",
  ),
);
router.delete(
  "/conversations/:conversationId/messages/:messageId",
  validate(deleteMessageSchema),
  handle(
    (req) =>
      Messages.mutate(
        req.user.id,
        req.validated.params.conversationId,
        req.validated.params.messageId,
        req.validated.query.scope === "me" ? "hide" : "delete",
      ),
    "Message deletion saved successfully.",
  ),
);
