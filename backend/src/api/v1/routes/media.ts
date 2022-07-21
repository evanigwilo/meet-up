// 👇 Express
import express, { NextFunction, Request, Response } from 'express';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Multer
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage'; // 👇 Middleware
import { authCheck } from '../middleware/auth';
// 👇 Services
import { socket } from '../services/client';
// 👇 Constants, Helpers & Types
import { maxUploadSize, mimeTypes } from '../constants';
import { ResponseCode, MediaCategory, UploadType } from '../types/enum';
import {
  getMediaFile,
  mongoGetDb,
  mongoUrl,
  uploadCheck,
  deleteCanceledMediaUploads,
  uniqueId,
  uploadProgress,
  uploadError,
} from '../helpers';

// 👇 canceled uploads variable
const canceledUploads: string[] = [];

const cancelUpload = (tempId: string) => {
  canceledUploads.push(tempId);
  deleteCanceledMediaUploads(canceledUploads);
};

const routePath = '/media/:category/:id';

const router = express.Router();

const checkQuery = async (req: Request, res: Response, next: NextFunction) => {
  const { id, category } = req.params;
  // 👇 initialize multer variables
  req.multer = req.multer || {};
  const { multer } = req;

  if (category !== MediaCategory.MESSAGE && category !== MediaCategory.POST && category !== MediaCategory.REPLY) {
    return res.status(400).send({
      code: ResponseCode.MEDIA_CATEGORY_INVALID,
      message: 'Media category is invalid.',
    });
  }

  const value = await socket.get(id);

  // 👇 verify if id is valid for only media type upload
  if (value !== UploadType.MESSAGE_MEDIA && value !== UploadType.POST_MEDIA && value !== UploadType.REPLY_MEDIA) {
    return res.status(400).send({
      code: ResponseCode.MEDIA_ID_INVALID,
      message: 'Media identifier is invalid.',
    });
  }

  multer.type = value;

  return next();
};

const uploadMedia = async (req: Request, res: Response) => {
  const { id, category } = req.params;
  const mediaDb = mongoGetDb('media');
  // 👇 temp name for file upload; In case of abort, gets removed from Db
  const tempId = '_temp_' + uniqueId();
  const user = req.authInfo as Required<Express.AuthInfo>;
  const { id: userId, username, email, auth } = user;

  req.on('aborted', () => {
    req.multer.abort = true;
    cancelUpload(tempId);
  });

  const upload = multer({
    storage: new GridFsStorage({
      url: mongoUrl('media'),
      cache: true,
      file: (req, file) => ({
        metadata: {
          userId,
          category,
          username,
          email,
          auth,
        },
        bucketName: tempId,
        filename: id,
        chunkSize: 256000, // 256kb
      }),
    }),
    fileFilter: async (req, { mimetype }, callback) => {
      const multer = req.multer;

      // 👇 verify that media file does not exist
      const file = await getMediaFile(mediaDb, id, {
        filename: id,
      });

      if (file) {
        multer.error = {
          code: ResponseCode.MEDIA_EXISTS,
          message: 'Media identifier already in use.',
        };
        // 👇 verify if media type is supported
      } else if (!mimeTypes.video.includes(mimetype) && !mimeTypes.audio.includes(mimetype)) {
        multer.error = {
          code: ResponseCode.INVALID_MIMETYPE,
          message: 'File is not a supported media type.',
        };

        // 👇 verify if media size is <= 50 MB
      } else if ((Number(req.headers['content-length']) || 0) > maxUploadSize.media) {
        // 50 MB
        multer.error = {
          code: ResponseCode.MAX_FILE_SIZE,
          message: `File exceeds maximum upload size (${maxUploadSize.media / 1024 / 1024}MB).`,
        };
      }

      if (multer.error) {
        cancelUpload(tempId);
        callback(multer.error as unknown as Error);
      } else {
        callback(null, true);
      }
    },
  });

  upload.single('media')(req, res, async (error) => {
    const { file, multer } = req;

    if (multer.abort) {
      return;
    }

    if (error) {
      cancelUpload(tempId);
      return uploadError(error, res);
    }

    if (!file) {
      return res.status(400).json({
        code: ResponseCode.FILE_MISSING,
        message: 'File is not supplied.',
      });
    }

    // 👇 try renaming collection from temporary name
    try {
      await mediaDb?.db.collection(tempId + '.chunks').rename(id + '.chunks');
      await mediaDb?.db.collection(tempId + '.files').rename(id + '.files');
    } catch (error) {
      cancelUpload(tempId);
      return res.status(500).json({
        code: ResponseCode.UPLOAD_FAILED,
        message: 'Media failed to upload.',
      });
    }

    // 👇 delete media if no reference to it for the next 5 mins
    uploadCheck({
      type: multer.type!,
      identifier: id,
      userId: user.id,
      cancelUpload: () => cancelUpload(id),
    });

    return res.json({ file, id });
  });
};

router.post(routePath, authCheck(), checkQuery, uploadProgress, uploadMedia);

// 👇 route for streaming a media
router.get(routePath, async (req: Request, res) => {
  const mediaDb = mongoGetDb('media');
  const { id, category } = req.params;
  const file = await getMediaFile(mediaDb, id, {
    filename: id,
    'metadata.category': category,
  });
  if (!file) {
    return res.status(400).json({
      code: ResponseCode.MEDIA_INVALID,
      message: 'Media not found.',
    });
  }

  // 👇 Create response headers
  const size = file.length;
  const range = req.headers.range || '0';
  const ranges = range.replace(/bytes=/, '').split('-');
  const start = parseInt(ranges[0], 10);
  const end = ranges[1] ? parseInt(ranges[1], 10) : size - 1;

  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1,
    'Content-Type': file.contentType,
  };

  // 👇  HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // @ts-ignore: Object is possibly 'null'.
  const bucket = new mongoose.mongo.GridFSBucket(mediaDb.db, {
    bucketName: id,
  });
  const uploadStream = bucket.openDownloadStream(file._id, { start, end: size });
  /*
    .pipe(res);
  */
  uploadStream.on('data', (chunk) => {
    res.write(chunk);
  });
  uploadStream.on('end', () => {
    res.status(200).end();
  });
  uploadStream.on('error', ({ message }) => {
    res.status(500).send({
      code: ResponseCode.GENERIC_ERROR,
      message,
    });
  });
});

router.delete(routePath, authCheck(), async (req: Request, res) => {
  const mediaDb = mongoGetDb('media');
  const { id, category } = req.params;
  const filename = id;

  const file = await getMediaFile(mediaDb, filename, {
    filename,
    'metadata.userId': req.authInfo?.id,
    'metadata.category': category,
  });

  if (!file) {
    return res.status(400).json({
      code: ResponseCode.FAILED,
      message: false,
    });
  }

  const deleteFile = await mediaDb?.db.collection(filename + '.files').drop();
  const deleteChunks = await mediaDb?.db.collection(id + '.chunks').drop();

  res.status(200).json({
    code: ResponseCode.SUCCESS,
    message: deleteFile && deleteChunks,
  });
});

export default router;
