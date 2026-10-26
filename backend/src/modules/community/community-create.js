import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import { ZodError } from 'zod';
import AppError from '../../core/errors/app-error.js';
import Response from '../../core/response/index.js';
import Database from '../../database/database-manager.js';
import Storage from '../../providers/storage/storage-manager.js';
import Media from '../media/media.repository.js';
import { inspectProfilePhotoFile } from '../users/utils/profile-photo-file.util.js';
import validate from '../../middleware/validate.middleware.js';
import Service from './community.service.js';
import { handle } from './community.controller.js';
import { creation, multipartCreation } from './community.validation.js';

const receive = multer({
  storage: multer.diskStorage({ destination: tmpdir(), filename: (_req, _file, cb) => cb(null, `community-${randomUUID()}`) }),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 3, fieldSize: 4096, parts: 5 }
}).single('image');
const jsonCreate = handle((s, u, v) => s.create(u, v.body), 'Community created successfully.', true);

export async function createCommunity(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return validate(creation)(req, res, error => error ? next(error) : jsonCreate(req, res, next));
  }

  let stored, committed = false;
  try {
    await new Promise((resolve, reject) => receive(req, res, error => error ? reject(error) : resolve()))
      .catch(error => {
        if (error instanceof multer.MulterError) throw error;
        throw new AppError({ code: 'COMMUNITY.IMAGE_INVALID', message: 'Malformed multipart request.', statusCode: 400 });
      });
    const input = await multipartCreation.parseAsync({ body: req.body, params: req.params, query: req.query });
    if (!req.file) throw new AppError({ code: 'COMMUNITY.IMAGE_REQUIRED', message: 'Upload an image in the image field.', statusCode: 400 });
    const inspected = await inspectProfilePhotoFile(req.file);
    stored = { ...inspected, ...await Storage.store({ temporaryPath: inspected.temporaryPath, category: 'community-images', userId: req.user.id, extension: inspected.extension }) };

    // Persist the image and community together: failure must not leave an orphan asset.
    const result = await Database.transaction(async client => {
      const media = await Media.resolveUploadedAssets({ client, userId: req.user.id, isPublic: true, uploads: [{ ...stored, fileIndex: 0 }] });
      const id = await Service.createInTransaction(req.user.id, { ...input.body, iconAssetId: media.assets[0].id }, client);
      return { id, media };
    });
    committed = true;
    for (const object of [...result.media.unusedStoredObjects, ...result.media.supersededStoredObjects]) {
      try { await Storage.remove(object); } catch { /* committed media remains valid */ }
    }
    return Response.created(res, await Service.get(req.user.id, result.id), 'Community created successfully.');
  } catch (error) {
    if (stored && !committed) { try { await Storage.remove(stored); } catch { /* preserve original failure */ } }
    if (error instanceof multer.MulterError) return next(new AppError({ code: 'COMMUNITY.IMAGE_INVALID', message: 'Upload one image up to 10 MiB with name, description and joinType fields only.', statusCode: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 }));
    if (error instanceof ZodError) return next(new AppError({ code: 'COMMON.VALIDATION_FAILED', message: 'Validation failed.', statusCode: 400, details: error.flatten() }));
    return next(error);
  } finally {
    if (req.file?.path) { try { await unlink(req.file.path); } catch { /* moved or already removed */ } }
  }
}
