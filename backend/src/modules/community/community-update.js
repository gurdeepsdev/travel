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
import { editing, multipartEditing } from './community.validation.js';

const receive = multer({
  storage: multer.diskStorage({ destination: tmpdir(), filename: (_req, _file, cb) => cb(null, `community-update-${randomUUID()}`) }),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 3, fieldSize: 4096, parts: 5 }
}).single('image');
const jsonUpdate = handle((s, u, v) => s.update(u, v.params.communityId, v.body));

export async function updateCommunity(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return validate(editing)(req, res, error => error ? next(error) : jsonUpdate(req, res, next));
  }
  let stored, committed = false;
  try {
    await new Promise((resolve, reject) => receive(req, res, error => error ? reject(error) : resolve()))
      .catch(error => {
        if (error instanceof multer.MulterError) throw error;
        throw new AppError({ code: 'COMMUNITY.IMAGE_INVALID', message: 'Malformed multipart request.', statusCode: 400 });
      });
    const input = await multipartEditing.parseAsync({ body: req.body, params: req.params, query: req.query });
    const id = input.params.communityId;
    if (!req.file) {
      req.validated = input;
      return validate(editing)(req, res, error => error ? next(error) : jsonUpdate(req, res, next));
    }
    const current = await Service.get(req.user.id, id);
    if (current.community.viewerRole !== 'ADMIN') throw new AppError({ code: 'COMMUNITY.NOT_FOUND', message: 'Community is unavailable.', statusCode: 404 });
    const inspected = await inspectProfilePhotoFile(req.file);
    stored = { ...inspected, ...await Storage.store({ temporaryPath: inspected.temporaryPath, category: 'community-images', userId: req.user.id, extension: inspected.extension }) };
    const media = await Database.transaction(async client => {
      // Lock and recheck admin access before media persistence, matching JSON update lock order.
      await Service.lockForUpdate(req.user.id, id, client);
      const media = await Media.resolveUploadedAssets({ client, userId: req.user.id, isPublic: true, uploads: [{ ...stored, fileIndex: 0 }] });
      await Service.updateInTransaction(req.user.id, id, { ...input.body, iconAssetId: media.assets[0].id }, client);
      return media;
    });
    committed = true;
    for (const object of [...media.unusedStoredObjects, ...media.supersededStoredObjects]) {
      try { await Storage.remove(object); } catch { /* committed media remains valid */ }
    }
    return Response.success(res, await Service.get(req.user.id, id), 'Community updated successfully.');
  } catch (error) {
    if (stored && !committed) { try { await Storage.remove(stored); } catch { /* preserve original failure */ } }
    if (error instanceof multer.MulterError) return next(new AppError({ code: 'COMMUNITY.IMAGE_INVALID', message: 'Upload one image up to 10 MiB with name, description and joinType fields only.', statusCode: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 }));
    if (error instanceof ZodError) return next(new AppError({ code: 'COMMON.VALIDATION_FAILED', message: 'Validation failed.', statusCode: 400, details: error.flatten() }));
    return next(error);
  } finally {
    if (req.file?.path) { try { await unlink(req.file.path); } catch { /* moved or already removed */ } }
  }
}
