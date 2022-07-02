// 👇 .env destructuring
export const {
  PROTOCOL,
  SERVER_PORT,
  SERVER_HOST,
  DEV_LANG,
  NODE_ENV,
  API_VERSION,
  SESSION_ID,
  SESSION_SECRET,
  OAUTH_GOOGLE_CLIENTID,
  OAUTH_GOOGLE_CLIENTSECRET,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET,
  REDIS_DB_HOST,
  REDIS_DB_PORT,
  DATABASE_DIALECT,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_DB,
  DATABASE_HOST,
  DATABASE_PORT,
  MONGO_INITDB_ROOT_USERNAME,
  MONGO_INITDB_ROOT_PASSWORD,
  MONGO_INITDB_DATABASE,
  MONGO_DB_HOST,
  MONGO_DB_PORT,
} = process.env;

// 👇 development language
// js = typescript watch + nodemon
// ts = ts-node + nodemon
export const devJs = DEV_LANG === 'js';
export const testing = NODE_ENV === 'testing';
export const production = NODE_ENV === 'production';
export const development = NODE_ENV === 'development';
export const rootDir = production || devJs ? 'build/api/v1' : 'src/api/v1';
export const fileExtension = production || devJs ? '*.js' : '*.ts';
export const imagesPath = production || devJs ? '../../../../src/api/v1/images' : '../images';
export const mediaPath = production || devJs ? '../../../../src/api/v1/media' : '../media';

export const apiPath = production ? '/api' : '';
export const authGoogle = API_VERSION + '/auth/google';
export const authFacebook = API_VERSION + '/auth/facebook';

export const mimeTypes = {
  image: 'image/png, image/gif, image/jpeg, image/bmp, image/svg+xml',
  video: 'video/mp4, video/mpeg, video/ogg, video/webm',
  audio: 'audio/ogg, audio/wav, audio/mp4, audio/aac, audio/mpeg, audio/webm',
};

export const realDate = Date;
// 👇 Sat Jan 01 2022 00:00:00 GMT+0000 (Greenwich Mean Time)
export const testDate = new Date('2022-01-01');
export const testTime = testDate.getTime();
export const msOneDay = 24 * 60 * 60 * 1000;

// 👇 mongo databases
export const mongoDbs = {
  image: MONGO_INITDB_DATABASE,
  media: 'media',
};
export const reactions = {
  like: '👍',
  love: '❤️',
  funny: '😂',
  wow: '😲',
  sad: '😔',
  angry: '😡',
};

// 👇 maximum items to return from database for each query requests
export const maxLimit = 10;

// 👇 maximum users to return from database for user search requests
export const maxUsers = 5;

// 👇 5 minutes redis expiry time in seconds
export const expire5mins = 60 * 5;

export const serverName = 'SERVER';

export const testDbConnectionFailed = 'Database connection failed.';

// 👇 missed video call constant
export const missedVideoCall = 'MISSED VIDEO CALL';

// 👇 server ready message
export const serverReady = `\n🚀 Server ready at ${PROTOCOL}://${SERVER_HOST}:${SERVER_PORT}${API_VERSION}`;

// 👇 cookie max age in ms of 1 hour
export const maxAge = 1000 * 60 * 60;

// 👇 delete canceled upload repetition
export const deleteIterations = 5;

export const maxUploadSize = {
  media: 1024 * 1024 * 50, // 50 MB
  image: 1024 * 1024, // 1 MB
};
