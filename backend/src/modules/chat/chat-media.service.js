import { posix } from "node:path";
import { access } from "node:fs/promises";
import Database from "../../database/database-manager.js";
import { resolveStoragePath } from "../../providers/storage/local.provider.js";
import AppError from "../../core/errors/app-error.js";

const missing = () => new AppError({ code: "CHAT.ASSET_NOT_FOUND", message: "Attachment preview is unavailable.", statusCode: 404 });
const root = (conversationId, messageId, assetId) =>
  `/api/v1/chat/conversations/${conversationId}/messages/${messageId}/attachments/${assetId}/preview`;

export async function decorateChatMedia(client, conversationId, messages) {
  const ids = messages.flatMap(m => m.deleted ? [] : (m.assets ?? []).map(a => a.id));
  if (!ids.length) return messages;
  const { rows } = await client.query(`SELECT asset_id,status,metadata FROM chat.asset_optimizations
    WHERE asset_id=ANY($1::uuid[])`, [ids]);
  const lookup = new Map(rows.map(r => [r.asset_id, r]));
  return messages.map(message => ({ ...message, assets: (message.assets ?? []).map(asset => {
    const row = lookup.get(asset.id);
    if (!row) return asset;
    const base = root(conversationId, message.id, asset.id), ready = row.status === "READY";
    const meta = ready ? row.metadata : {};
    return { ...asset, optimization: {
      status: row.status, width: meta.width ?? null, height: meta.height ?? null,
      imageVariants: (meta.imageVariants ?? []).map(v => ({
        size: v.size, width: v.width, height: v.height, fileSize: v.fileSize,
        mimeType: "image/webp", url: `${base}/images/${v.size}`,
      })),
      thumbnailUrl: meta.thumbnailStorageKey ? `${base}/thumbnail` : null,
      streamUrl: meta.hlsManifestStorageKey ? `${base}/stream/master.m3u8` : null,
      playbackUrl: meta.outputStorageKey ? `${base}/video.mp4` : null,
    }};
  }) }));
}

// Called only after the existing conversation/message/asset authorization succeeds.
export async function getChatPreview(assetId, resource) {
  const { rows: [row] } = await Database.query(`SELECT o.metadata FROM chat.asset_optimizations o
    JOIN media.assets a ON a.id=o.asset_id WHERE o.asset_id=$1::uuid AND o.status='READY'
      AND a.storage_provider='local' AND a.is_public IS FALSE AND a.deleted_at IS NULL
      AND a.dedup_scope='chat_private'`, [assetId]);
  if (!row) throw missing();
  const meta = row.metadata;
  let key, mimeType;
  if (resource.kind === "image") {
    key = meta.imageVariants?.find(v => v.size === resource.size)?.storageKey;
    mimeType = "image/webp";
  } else if (resource.kind === "thumbnail") {
    key = meta.thumbnailStorageKey; mimeType = "image/jpeg";
  } else if (resource.kind === "video") {
    key = meta.outputStorageKey; mimeType = "video/mp4";
  } else if (resource.kind === "master") {
    key = meta.hlsManifestStorageKey; mimeType = "application/vnd.apple.mpegurl";
  } else if ((meta.renditions ?? []).includes(resource.rendition) &&
      /^(index\.m3u8|segment_\d+\.ts)$/.test(resource.fileName)) {
    key = posix.join(posix.dirname(meta.hlsManifestStorageKey), resource.rendition, resource.fileName);
    mimeType = resource.fileName.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
  }
  if (!key || !key.startsWith(meta.root + "/")) throw missing();
  const filePath = resolveStoragePath(key);
  try { await access(filePath); } catch { throw missing(); }
  return { filePath, mimeType };
}
