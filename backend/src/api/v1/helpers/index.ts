// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Constants, Helpers & Types
import { ImageProjection, ImageSchema, KeyValue, MediaProjection, MediaSchema, Reacted, SocketMessage } from '../types';
import { AuthType, ModelType, NotificationType, Publish, ResponseCode, UploadType, Gender } from '../types/enum';
import {
  DATABASE_DIALECT,
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_DB,
  rootDir,
  fileExtension,
  MONGO_DB_HOST,
  MONGO_DB_PORT,
  MONGO_INITDB_ROOT_PASSWORD,
  MONGO_INITDB_ROOT_USERNAME,
  mongoDbs,
  maxLimit,
  expire5mins,
  testing,
  testDbConnectionFailed,
  development,
  deleteIterations,
  missedVideoCall,
  msOneDay,
  testTime,
  production,
} from '../constants';

// 👇 unique id generator
export const uniqueId = (length = 16) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const mongoUrl = (db: string) =>
  `mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@${MONGO_DB_HOST}:${MONGO_DB_PORT}/${db}?authSource=${MONGO_INITDB_ROOT_USERNAME}`;

export const mongoGetDb = (db: keyof typeof mongoDbs) =>
  mongoose.connections.find((connection) => connection.name === mongoDbs[db]);

export const getImageFile = async (
  mediaDb: mongoose.Connection | undefined,
  collection: ModelType,
  filter: KeyValue<string | undefined>,
  // 👇 specify or restrict the data returned in query results
  projection: ImageProjection = {
    filename: true,
    metadata: {
      userId: true,
      username: true,
      auth: true,
    },
    image: {
      contentType: true,
    },
  },
) => {
  if (!mediaDb) {
    return null;
  }
  const file = await mediaDb.collection(collection).findOne<ImageSchema>(filter, {
    projection,
  });

  return file;
};

export const getMediaFile = async (
  mediaDb: mongoose.Connection | undefined,
  collection: string,
  filter: KeyValue<string | undefined>,
  // 👇 specify or restrict the data returned in query results
  projection: MediaProjection = {
    filename: true,
    length: true,
    contentType: true,
    metadata: {
      userId: true,
      username: true,
      auth: true,
      category: true,
    },
  },
) => {
  if (!mediaDb) {
    return null;
  }
  const file = await mediaDb.collection(collection + '.files').findOne<MediaSchema>(filter, {
    projection,
  });

  return file;
};
