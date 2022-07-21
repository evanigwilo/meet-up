// 👇 Express
import express, { NextFunction, Request, Response } from 'express';
// 👇 Multer
import multer from 'multer';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Node
import path from 'path';
// 👇 Models
import * as Models from '../models/Image';
// 👇 Middleware
import { authCheck } from '../middleware/auth';
// 👇 Services
import { socket } from '../services/client';
// 👇 Constants, Helpers & Types
import { imagesPath, mimeTypes, maxUploadSize } from '../constants';
import {
  createNotification,
  deleteCanceledImageUploads,
  formatBytes,
  uploadCheck,
  uploadError,
  uploadProgress,
} from '../helpers';
import { ResponseCode, UploadType, NotificationType, ModelType, MediaCategory } from '../types/enum';

// 👇 canceled uploads variable
const canceledUploads: string[] = [];

const cancelUpload = (collection: ModelType, id: string) => {
  canceledUploads.push(id);
  deleteCanceledImageUploads(collection, canceledUploads);
};

const router = express.Router();

const mainPath = '/image/:category/:id';
const postDeletePath = ['/image/:category', mainPath];
const getPath = ['/image/:category/:auth/:username', mainPath];

const checkQuery = async (req: Request, res: Response, next: NextFunction) => {
  const { id, category } = req.params;

  // 👇 initialize multer variables
  req.multer = req.multer || {};
  const { multer } = req;

  switch (category) {
    case MediaCategory.AVATAR:
      multer.collection = ModelType.AVATAR;
      break;
    case MediaCategory.MESSAGE:
      multer.collection = ModelType.MESSAGE;
      break;
    case MediaCategory.POST:
      multer.collection = ModelType.POST;
      break;
    case MediaCategory.REPLY:
      multer.collection = ModelType.REPLY;
      break;

    default:
      return res.status(400).send({
        code: ResponseCode.IMAGE_CATEGORY_INVALID,
        message: 'Image category is invalid.',
      });
  }

  const { method } = req;

  if (method === 'POST' || method === 'DELETE') {
    const error = {
      code: ResponseCode.IMAGE_ID_INVALID,
      message: 'Image identifier is invalid.',
    };

    // 👇 return error if uploading post/reply/message with no 'id' params
    if (!id) {
      if (category !== MediaCategory.AVATAR) {
        error.message = 'Image identifier needed for posts and messages upload.';
        return res.status(400).send(error);
      }
    } else {
      // 👇 return error if uploading profile with 'id' params
      if (category === MediaCategory.AVATAR) {
        error.message = 'Image identifier not needed for profile upload.';
        return res.status(400).send(error);
      }

      if (method === 'POST') {
        const value = await socket.get(id);
        // 👇 verify if id is valid for only image type upload
        if (value !== UploadType.MESSAGE_IMAGE && value !== UploadType.POST_IMAGE && value !== UploadType.REPLY_IMAGE) {
          return res.status(400).send(error);
        }
        multer.type = value;
      }
    }
  }

  return next();
};

const uploadImage = (req: Request, res: Response) => {
  /*
  const storage = multer.diskStorage({
    //Specify the destination directory where the file needs to be saved
    destination: function (req, file, cb) {
      cb(null, './uploads');
    },
    //Specify the name of the file. date is prefixed to avoid overwrite of files.
    filename: function (req, file, cb) {
      cb(null, Date.now() + '_' + file.originalname);
    },
  });
  */
  const {
    params,
    multer: { collection },
  } = req;
  const { id } = params;

  req.on('aborted', () => {
    req.multer.abort = true;
    if (collection) {
      cancelUpload(collection, id);
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    /*
    limits: {
      fileSize: 1024 * 1024, // 👉 Maximum allowed size in bytes (1 MB)
    },
    */
    fileFilter: (req, { mimetype }, callback) => {
      const multer = req.multer;

      // 👇 verify if image type is supported
      if (!mimeTypes.image.includes(mimetype)) {
        multer.error = {
          code: ResponseCode.INVALID_MIMETYPE,
          message: 'File is not a supported image type.',
        };
        /* 
          callback(new Error('File is not an image type));
        */
        // 👇 verify if image size is <= 1 MB
      } else if ((Number(req.headers['content-length']) || 0) > maxUploadSize.image) {
        multer.error = {
          code: ResponseCode.MAX_FILE_SIZE,
          message: `File exceeds maximum upload size (${maxUploadSize.image / 1024 / 1024}MB).`,
        };
      }

      if (multer.error) {
        callback(multer.error as unknown as Error);
      } else {
        callback(null, true);
      }
    },
  });

  upload.single('image')(req, res, async (error) => {
    const { file, authInfo, multer } = req;

    if (multer.abort) {
      return;
    }

    if (error) {
      return uploadError(error, res);
    }

    if (!file) {
      return res.status(400).json({
        code: ResponseCode.FILE_MISSING,
        message: 'File is not supplied.',
      });
    }

    const user = authInfo as Required<Express.AuthInfo>;

    let model: mongoose.Model<any> | undefined;
    let filename = id;
    if (collection === ModelType.AVATAR) {
      filename = user.id;
      model = Models.Avatar();
    } else {
      if (collection === ModelType.MESSAGE) {
        model = Models.Message();
      } else if (collection === ModelType.POST) {
        model = Models.Post();
      } else {
        model = Models.Reply();
      }
    }

    // 👇 save image to Db and send notifications
    try {
      const { buffer, mimetype, size } = file;
      const { username, email, auth } = user;
      await model?.findOneAndUpdate(
        { filename },
        {
          filename,
          metadata: {
            userId: user.id,
            username,
            email,
            auth,
          },
          image: {
            data: buffer,
            contentType: mimetype,
            size: formatBytes(size),
          },
        },
        { upsert: true, new: true },
      );

      if (collection === ModelType.AVATAR) {
        createNotification(NotificationType.PROFILE_UPDATE, user, `${auth}/${username}`, user);
      }
    } catch (error) {
      if (collection) {
        cancelUpload(collection, filename);
      }
      return res.status(500).json({
        code: ResponseCode.UPLOAD_FAILED,
        message: 'Image failed to upload.',
      });
    }

    if (collection !== ModelType.AVATAR) {
      // 👇 delete image if no reference to it for the next 5 mins
      uploadCheck({
        type: multer.type!,
        identifier: id,
        userId: user.id,
        cancelUpload: () => {
          if (collection) {
            cancelUpload(collection, id);
          }
        },
      });
    }

    return res.status(200).json({
      code: ResponseCode.SUCCESS,
      message: 'Image uploaded successfully.',
    });
  });
};

router.post(postDeletePath, authCheck(), checkQuery, uploadProgress, uploadImage);

router.delete(postDeletePath, authCheck(), checkQuery, async (req, res) => {
  const {
    authInfo,
    params,
    multer: { collection },
  } = req;

  if (collection === ModelType.AVATAR) {
    await Models.Avatar()?.deleteOne({ filename: authInfo?.id });
  } else {
    await (collection === ModelType.MESSAGE
      ? Models.Message()
      : collection === ModelType.POST
      ? Models.Post()
      : Models.Reply()
    )?.deleteOne({ filename: params.id });
  }

  return res.status(200).json({
    code: ResponseCode.SUCCESS,
    message: 'Image deleted successfully.',
  });
});

router.get(getPath, checkQuery, async (req, res) => {
  const {
    params,
    multer: { collection },
  } = req;
  const { id, auth, username } = params;

  let model: mongoose.Model<any> | undefined;
  let option: Record<string, string> | null = null;
  let noImage: string | null = null;
  if (collection === ModelType.AVATAR) {
    noImage = path.join(__dirname, imagesPath, 'avatar.png');
    option = id
      ? {
          filename: id,
        }
      : { 'metadata.auth': auth, 'metadata.username': username };
    model = Models.Avatar();
  } else {
    noImage = path.join(__dirname, imagesPath, 'error.png');
    option = {
      filename: id,
    };
    if (collection === ModelType.MESSAGE) {
      model = Models.Message();
    } else if (collection === ModelType.POST) {
      model = Models.Post();
    } else {
      model = Models.Reply();
    }
  }

  try {
    const image = await model?.findOne(option);
    if (!image) {
      return res.sendFile(noImage);
    }
    const {
      image: { contentType, data },
    } = image;
    res.contentType(contentType);
    res.send(data);
  } catch {
    return res.sendFile(noImage);
  }
});

export default router;
