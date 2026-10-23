import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import AppError from '../../core/errors/app-error.js';
import Database from '../../database/database-manager.js';
import Storage from '../../providers/storage/storage-manager.js';
import Media from '../media/media.repository.js';
import { inspectProfilePhotoFile } from '../users/utils/profile-photo-file.util.js';
import Response from '../../core/response/index.js';
const receive = multer({ storage: multer.diskStorage({ destination: tmpdir(), filename: (_req,_file,cb) => cb(null,`community-${randomUUID()}`) }),
  limits: { files: 1, fileSize: 10*1024*1024, fields: 0, parts: 2 } }).single('image');
export async function uploadCommunityImage(req,res,next) {
  let stored, committed = false;
  try {
    await new Promise((resolve,reject) => receive(req,res,error => error ? reject(error) : resolve()));
    if (!req.file) throw new AppError({ code:'COMMUNITY.IMAGE_REQUIRED',message:'Upload an image in the image field.',statusCode:400 });
    const inspected = await inspectProfilePhotoFile(req.file);
    stored = { ...inspected, ...await Storage.store({ temporaryPath: inspected.temporaryPath,category:'community-images',userId:req.user.id,extension:inspected.extension }) };
    const result = await Database.transaction(client => Media.resolveUploadedAssets({ client,userId:req.user.id,isPublic:true,uploads:[{...stored,fileIndex:0}] }));
    committed = true;
    for (const object of [...result.unusedStoredObjects,...result.supersededStoredObjects]) {
      try { await Storage.remove(object); } catch { /* existing media remains valid */ }
    }
    const asset = result.assets[0];
    return Response.success(res,{asset:{id:asset.id,url:`/api/v1/media/assets/${asset.id}/content`,mimeType:asset.mime_type}},'Community image uploaded successfully.');
  } catch (error) {
    if (stored && !committed) { try { await Storage.remove(stored); } catch { /* preserve original error */ } }
    if (error instanceof multer.MulterError) return next(new AppError({code:'COMMUNITY.IMAGE_INVALID',message:'Upload one image up to 10 MiB.',statusCode:error.code==='LIMIT_FILE_SIZE'?413:400}));
    return next(error);
  } finally { if (req.file?.path) { try { await unlink(req.file.path); } catch { /* temporary file already moved */ } } }
}
