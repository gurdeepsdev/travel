import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename } from "node:path";
import { fileTypeFromFile } from "file-type";
import Database from "../../database/database-manager.js";
import Storage from "../../providers/storage/storage-manager.js";
import MediaRepository from "../media/media.repository.js";
import AppError from "../../core/errors/app-error.js";
import Response from "../../core/response/index.js";
import { authorize } from "./chat-messages.service.js";
import { scanChatAttachment } from "./chat-malware.service.js";

const receive = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, cb) => cb(null, `artictern-chat-${randomUUID()}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
}).single("attachment");
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
]);
const cleanup = async (path) => {
  if (path)
    try {
      await unlink(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
};

export async function uploadChatAttachment(req, res, next) {
  let stored = null,
    committed = false;
  try {
    await authorize(
      Database,
      req.validated.params.conversationId,
      req.user.id,
      true,
    );
    await new Promise((resolve, reject) =>
      receive(req, res, (error) => (error ? reject(error) : resolve())),
    );
    if (!req.file)
      throw new AppError({
        code: "CHAT.ATTACHMENT_REQUIRED",
        message: "Attachment file is required.",
        statusCode: 400,
      });
    const detected = await fileTypeFromFile(req.file.path);
    if (!detected || !allowed.has(detected.mime))
      throw new AppError({
        code: "CHAT.ATTACHMENT_TYPE_INVALID",
        message: "Attachment must be JPEG, PNG, WebP, MP4, or PDF.",
        statusCode: 415,
      });
    await scanChatAttachment(req.file.path);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(req.file.path))
      hash.update(chunk);
    const file = await stat(req.file.path);
    stored = await Storage.store({
      temporaryPath: req.file.path,
      category: "chat",
      userId: req.user.id,
      extension: detected.ext,
    });
    const result = await Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1 FOR UPDATE",
        [req.validated.params.conversationId],
      );
      await authorize(
        client,
        req.validated.params.conversationId,
        req.user.id,
        true,
      );
      const resolved = await MediaRepository.resolveUploadedAssets({
        client,
        userId: req.user.id,
        isPublic: false,
        uploads: [
          {
            ...stored,
            fileIndex: 0,
            originalFilename: basename(req.file.originalname).slice(0, 255),
            mimeType: detected.mime,
            extension: detected.ext,
            fileSize: file.size,
            checksum: hash.digest("hex"),
            processingStatus: "READY",
          },
        ],
      });
      const asset = resolved.assets[0];
      if (asset.storage_provider !== "local")
        throw new AppError({
          code: "CHAT.ATTACHMENT_UNAVAILABLE",
          message: "Attachment is not available for private delivery.",
          statusCode: 409,
        });
      // Chat serves the original MP4 privately; it does not enqueue the post HLS pipeline.
      if (
        asset.storage_key === stored.storageKey &&
        asset.processing_status === "PROCESSING"
      ) {
        await client.query(
          "UPDATE media.assets SET processing_status='READY' WHERE id=$1",
          [asset.id],
        );
        asset.processing_status = "READY";
      }
      if (asset.processing_status !== "READY")
        throw new AppError({
          code: "CHAT.ATTACHMENT_NOT_READY",
          message: "Attachment is still processing.",
          statusCode: 409,
        });
      return resolved;
    });
    committed = true;
    for (const object of [
      ...result.unusedStoredObjects,
      ...result.supersededStoredObjects,
    ])
      try {
        await Storage.remove(object);
      } catch {
        /* cleanup can be retried */
      }
    const asset = result.assets[0];
    return Response.success(
      res,
      {
        asset: {
          id: asset.id,
          mimeType: asset.mime_type,
          fileSize: asset.file_size,
        },
      },
      "Chat attachment uploaded successfully.",
    );
  } catch (error) {
    if (!committed && stored)
      try {
        await Storage.remove(stored);
      } catch {
        /* preserve original error */
      }
    if (error instanceof multer.MulterError)
      return next(
        new AppError({
          code: "CHAT.ATTACHMENT_UPLOAD_INVALID",
          message: "Attachment upload exceeds permitted limits.",
          statusCode: error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
        }),
      );
    return next(error);
  } finally {
    try {
      await cleanup(req.file?.path);
    } catch {
      /* do not override response */
    }
  }
}
