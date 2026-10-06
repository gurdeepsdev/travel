import sharp from 'sharp';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import Database from '../../database/database-manager.js';
import storage from '../../providers/storage/video-object-storage.provider.js';
import { resolveStoragePath } from '../../providers/storage/local.provider.js';
import { IMAGE_JOB } from './video-processing.constants.js';

export { IMAGE_JOB };
export const IMAGE_SIZES = Object.freeze({ small: 320, medium: 640, large: 1080, custom: 1600 });
const QUALITY = 82;

export async function generateImageVariants(storageKey) {
  const input = resolveStoragePath(storageKey);
  const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  // Preserve animated originals rather than silently turning them into still images.
  if ((metadata.pages ?? 1) > 1) return [];
  const variants = [];
  try {
    for (const [name, size] of Object.entries(IMAGE_SIZES)) {
      const key = `${storageKey}.images-v1/${name}.webp`;
      const filePath = resolveStoragePath(key);
      await mkdir(dirname(filePath), { recursive: true });
      const info = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 4 }).timeout({ seconds: 30 }).toFile(filePath);
      variants.push({ name, storageKey: key, filePath, width: info.width, height: info.height, fileSize: info.size });
    }
    return variants;
  } catch (error) {
    await rm(resolveStoragePath(`${storageKey}.images-v1`), { recursive: true, force: true });
    throw error;
  }
}

export function createImageProcessor({ db = Database, objectStorage = storage, generate = generateImageVariants } = {}) {
  return async function process(assetId) {
    const uploaded = [];
    let generated = [];
    try {
      return await db.transaction(async (client) => {
        const { rows: [asset] } = await client.query(`SELECT id, storage_key, is_public FROM media.assets
          WHERE id = $1::uuid AND deleted_at IS NULL AND mime_type LIKE 'image/%'
            AND storage_provider = 'local' AND processing_status = 'READY' FOR UPDATE`, [assetId]);
        if (!asset) return { skipped: true };
        const { rows: existing } = await client.query(`SELECT variant_name AS name, storage_key AS "storageKey",
          width, height, file_size AS "fileSize", storage_provider AS "storageProvider"
          FROM media.asset_variants WHERE asset_id = $1::uuid AND format = 'webp' AND quality = 82
            AND variant_name IN ('small', 'medium', 'large', 'custom')`, [assetId]);
        const current = existing.filter((v) => v.storageKey.startsWith(`${asset.storage_key}.images-v1/`));
        const variants = current.length === 4 ? current : (generated = await generate(asset.storage_key));
        if (!variants.length) return { skipped: true };
        const staleRemote = existing.filter((v) => !current.includes(v) && v.storageProvider !== 'local');
        if (staleRemote.length) {
          if (!objectStorage.enabled) throw new Error('Object storage must be enabled to remove superseded image variants.');
          await objectStorage.removeMany(staleRemote.map((v) => v.storageKey));
        }
        for (const variant of variants) {
          const remote = asset.is_public && objectStorage.enabled;
          if (remote && variant.storageProvider !== objectStorage.name) {
            await objectStorage.uploadFile({ filePath: resolveStoragePath(variant.storageKey), storageKey: variant.storageKey });
            uploaded.push(variant.storageKey);
          } else if (!asset.is_public && variant.storageProvider && variant.storageProvider !== 'local') {
            if (!objectStorage.enabled) throw new Error('Object storage must be enabled to withdraw public image variants.');
            await objectStorage.removeMany([variant.storageKey]);
          }
          await client.query(`INSERT INTO media.asset_variants
            (asset_id, variant_name, format, quality, width, height, storage_key, file_size, storage_provider)
            VALUES ($1::uuid, $2, 'webp', 82, $3, $4, $5, $6, $7)
            ON CONFLICT (asset_id, variant_name, format, quality) DO UPDATE SET
              width = EXCLUDED.width, height = EXCLUDED.height, storage_key = EXCLUDED.storage_key,
              file_size = EXCLUDED.file_size, storage_provider = EXCLUDED.storage_provider`,
          [assetId, variant.name, variant.width, variant.height, variant.storageKey, variant.fileSize,
            remote ? objectStorage.name : (asset.is_public ? variant.storageProvider ?? 'local' : 'local')]);
        }
        return { skipped: false, assetId };
      });
    } catch (error) {
      if (uploaded.length) await Promise.allSettled([objectStorage.removeMany(uploaded)]);
      if (generated.length) await Promise.allSettled(generated.map((v) => rm(v.filePath, { force: true })));
      throw error;
    }
  };
}

export async function findImageCandidates(limit = 1000) {
  const { rows } = await Database.query(`SELECT a.id, a.mime_type, a.processing_status
    FROM media.assets a WHERE a.deleted_at IS NULL AND a.mime_type LIKE 'image/%'
      AND a.storage_provider = 'local' AND a.processing_status = 'READY'
      AND EXISTS (SELECT 1 FROM explore.post_assets pa JOIN explore.posts p ON p.id = pa.post_id
        WHERE pa.asset_id = a.id AND p.deleted_at IS NULL)
      AND (4 <> (SELECT COUNT(*) FROM media.asset_variants v WHERE v.asset_id = a.id
        AND v.format = 'webp' AND v.quality = 82 AND v.variant_name IN ('small','medium','large','custom')
        AND starts_with(v.storage_key, a.storage_key || '.images-v1/'))
        OR EXISTS (SELECT 1 FROM media.asset_variants v WHERE v.asset_id = a.id AND v.format = 'webp'
          AND v.quality = 82 AND ((a.is_public AND v.storage_provider = 'local')
            OR (NOT a.is_public AND v.storage_provider <> 'local'))))
    ORDER BY a.created_at ASC LIMIT $1`, [limit]);
  return rows;
}

export default { process: createImageProcessor() };
