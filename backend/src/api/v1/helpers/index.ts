// 👇 Typeorm
import { DataSource } from 'typeorm';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Node
import { get } from 'http';
import { get as gets } from 'https';
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

// 👇 database source initialize
export const dataSource = new DataSource({
  type: DATABASE_DIALECT as any,
  host: DATABASE_HOST,
  port: DATABASE_PORT as any,
  username: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_DB,
  migrationsRun: production || development,
  logging: development ? true : false,
  synchronize: testing || development ? true : false,
  dropSchema: false,
  entities: [rootDir + '/entity/**/' + fileExtension],
  migrations: [rootDir + '/migration/**/' + fileExtension],
  subscribers: [rootDir + '/subscriber/**/' + fileExtension],
  migrationsTableName: 'migrations',
});

export const { manager: entityManager } = dataSource;

// 👇 seconds to milliseconds convert for intervals
export const secsToMs = (secs: number) => secs * 1000;
// 👇 milliseconds to seconds convert
export const msToSecs = (ms: number) => Math.floor(ms / 1000);

export const sleep = (secs: number) => new Promise((handler) => setTimeout(handler, secsToMs(secs)));

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

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const urlToBuffer = (url: string) => {
  return new Promise((resolve, reject) => {
    const data: Uint8Array[] = [];
    // 👇 protocol check
    const fetch = url.startsWith('https://') ? gets : get;
    fetch(url, (res) => {
      res
        .on('data', (chunk: Uint8Array) => {
          data.push(chunk);
        })
        .on('end', () => {
          resolve({
            data: Buffer.concat(data),
            contentType: res.headers['content-type'],
            size: formatBytes(Number(res.headers['content-length']) || 0),
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  });
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
