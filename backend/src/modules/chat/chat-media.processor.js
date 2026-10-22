import sharp from "sharp";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Database from "../../database/database-manager.js";
import { resolveStoragePath } from "../../providers/storage/local.provider.js";
import { generateImageVariants, IMAGE_SIZES } from "../media/image-processing.service.js";
import { transcodeLocalVideo, finalizeTranscode } from "../media/video-transcoder.js";

export function createChatMediaProcessor({ db = Database, generate = generateImageVariants,
  transcode = transcodeLocalVideo, finalize = finalizeTranscode,
  inspect = key => sharp(resolveStoragePath(key), { limitInputPixels: 40_000_000 }).metadata(),
  copy = copyFile, makeDirectory = mkdir, remove = rm } = {}) {
  return async function process(assetId) {
    let outputRoot;
    try {
      return await db.transaction(async client => {
        const { rows: [asset] } = await client.query(`SELECT a.*,o.status AS optimization_status
          FROM media.assets a JOIN chat.asset_optimizations o ON o.asset_id=a.id
          WHERE a.id=$1::uuid AND a.deleted_at IS NULL AND a.dedup_scope='chat_private'
            AND a.is_public IS FALSE AND a.storage_provider='local' FOR UPDATE OF o`, [assetId]);
        if (!asset || asset.optimization_status === "READY") return { skipped: true };
        outputRoot = `${asset.storage_key}.chat-v1/${randomUUID()}`;
        await makeDirectory(resolveStoragePath(outputRoot), { recursive: true });
        const source = `${outputRoot}/source.${asset.mime_type.startsWith("image/") ? "image" : "mp4"}`;
        await copy(resolveStoragePath(asset.storage_key), resolveStoragePath(source));
        let metadata;
        if (asset.mime_type.startsWith("image/")) {
          const info = await inspect(source);
          const variants = await generate(source);
          const swapped = [5,6,7,8].includes(info.orientation);
          metadata = { root: outputRoot, width: swapped ? info.height : info.width,
            height: swapped ? info.width : info.height,
            imageVariants: variants.map(v => ({ size: IMAGE_SIZES[v.name], storageKey: v.storageKey,
              width: v.width, height: v.height, fileSize: v.fileSize })) };
          await remove(resolveStoragePath(source), { force: true });
        } else if (asset.mime_type.startsWith("video/")) {
          const result = await transcode({ assetId, storageKey: source });
          await finalize({ ...result, removeOutputs: false });
          metadata = { root: outputRoot, width: result.width, height: result.height,
            outputStorageKey: result.outputStorageKey, thumbnailStorageKey: result.thumbnailStorageKey,
            hlsManifestStorageKey: result.hlsManifestStorageKey, renditions: result.hlsRenditions };
        } else return { skipped: true };
        await client.query(`UPDATE chat.asset_optimizations SET status='READY',metadata=$2::jsonb,
          updated_at=CURRENT_TIMESTAMP WHERE asset_id=$1::uuid`, [assetId, JSON.stringify(metadata)]);
        await client.query(`INSERT INTO chat.event_outbox(conversation_id,message_id,event_type)
          SELECT m.conversation_id,m.id,'message.updated' FROM chat.chat_messages m
          JOIN chat.message_assets ma ON ma.message_id=m.id
          WHERE ma.asset_id=$1::uuid AND m.deleted_at IS NULL`, [assetId]);
        return { assetId, skipped: false };
      });
    } catch (error) {
      if (outputRoot) await remove(resolveStoragePath(outputRoot), { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  };
}
export default { process: createChatMediaProcessor() };

export async function markChatMediaFailed(assetId, db = Database) {
  await db.transaction(async client => {
    const { rowCount } = await client.query(`UPDATE chat.asset_optimizations
      SET status='FAILED',updated_at=CURRENT_TIMESTAMP
      WHERE asset_id=$1::uuid AND status='PENDING'`, [assetId]);
    if (rowCount) await client.query(`INSERT INTO chat.event_outbox(conversation_id,message_id,event_type)
      SELECT m.conversation_id,m.id,'message.updated' FROM chat.chat_messages m
      JOIN chat.message_assets ma ON ma.message_id=m.id
      WHERE ma.asset_id=$1::uuid AND m.deleted_at IS NULL`, [assetId]);
  });
}
