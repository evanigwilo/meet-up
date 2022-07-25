// 👇 Typeorm
import { DataSource } from 'typeorm';
// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Node
import { get } from 'http';
import { get as gets } from 'https';
// 👇 Express
import { NextFunction, Request, Response } from 'express';
// 👇 Entities
import Notification from '../entity/Notification';
import User from '../entity/User';
import Message from '../entity/Message';
import Post from '../entity/Post';
// 👇 Multer
import { MulterError } from 'multer';
// 👇 Services
import pubsub from '../services/pubsub';
import { socket } from '../services/client';
// 👇 Routes
import { passportInit, passportSession } from '../routes/OAuth';
// 👇 Middleware
import { auth } from '../middleware/auth';
import session from '../middleware/session';
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

// 👇 websocket message helpers
export const constructMessage = (message: SocketMessage) => JSON.stringify(message);
export const deconstructMessage = (message: string) => JSON.parse(message) as SocketMessage;

// 👇 update user last seen on session close
export const updateLastSeen = async (id: string) => {
  try {
    const active = new Date();
    // 👇 executes UPDATE user SET active = date WHERE id = 'id'
    await entityManager.update(User, { id }, { active });
  } catch (error) {
    // console.log('\nError Last Seen', { error });
  }
};

const getNotifications = async (type: NotificationType, from: Partial<User>, identifier: string, skip: number) =>
  await entityManager.find(Notification, {
    relations: {
      from: true,
      to: true,
    },
    where: { identifier, from: { id: from.id }, type },
    take: maxLimit,
    skip,
  });

export const createNotification = async (
  type: NotificationType,
  from: Partial<User>,
  identifier: string,
  to?: Partial<User>,
) => {
  if (type === NotificationType.POST_CREATE) {
    // 👇 notification of post created to users following the post creator
    await entityManager.query(
      `INSERT INTO notifications ("to", "from", "type", "identifier")
      ${entityManager
        .createQueryBuilder()
        .select('follow.user', 'to')
        .addSelect(`'${from.id}'`, 'from')
        .addSelect(`'${type}'`, 'type')
        .addSelect(`'${identifier}'`, 'identifier')
        .from('followers', 'follow')
        .where(`follow.following = '${from.id}'`)
        .getQuery()}
      `,
    );

    // 👇 publish notification to followers on a certain interval
    let skip = 0;
    let notifications = await getNotifications(NotificationType.POST_CREATE, from, identifier, skip);
    while (notifications.length) {
      for (const notification of notifications) {
        await pubsub.publish(Publish.NOTIFICATION, {
          [Publish.NOTIFICATION]: notification,
        });
      }
      await sleep(0.2);
      skip += notifications.length;
      notifications = await getNotifications(NotificationType.POST_CREATE, from, identifier, skip);
    }
  } else {
    const notification = await new Notification({
      from: { id: from.id, name: from.name },
      ...(to && {
        to: { id: to.id },
      }),
      type,
      identifier,
    }).save();

    await pubsub.publish(Publish.NOTIFICATION, {
      [Publish.NOTIFICATION]: notification,
    });
  }
};

export const createReacted = (
  message: Message,
  user: Partial<User>,
  reaction?: Reacted['reaction'],
): Partial<Reacted> => ({
  from: message.from.id,
  to: message.to.id,
  user: user.id,
  message: message.id,
  deleted: !Boolean(reaction),
  reaction,
});

export const findMessage = async (id: string, from: string, to?: string): Promise<Message | null> => {
  const where = to
    ? [
        { from: { id: from }, id },
        { to: { id: to }, id },
      ]
    : {
        id,
        from: { id: from },
      };

  const message = await entityManager.findOne(Message, {
    relations: {
      from: true,
      to: true,
    },
    where,
  });

  return message;
};

// 👇 delete canceled image uploads on abort
export const deleteCanceledImageUploads = async (collection: string, canceledUploads: string[]) => {
  const imageDb = mongoGetDb('image');

  for (let id = canceledUploads.pop(); id !== undefined; id = canceledUploads.pop()) {
    for (let i = 0; i < deleteIterations; i++) {
      try {
        await imageDb?.db.collection(collection).deleteOne({ filename: id });
      } catch {}

      await sleep(3);
    }
  }
};

// 👇 delete canceled media uploads on abort
export const deleteCanceledMediaUploads = async (canceledUploads: string[]) => {
  // console.log({ 'Total Deletes': canceledUploads.length });
  const mediaDb = mongoGetDb('media');

  for (let tempId = canceledUploads.pop(); tempId !== undefined; tempId = canceledUploads.pop()) {
    for (let i = 0; i < deleteIterations; i++) {
      /*
        console.log({
          [tempId]: i,
          'Total Deletes': canceledUploads.length,
          total: (await mediaDb.db.collection(tempId + '.chunks').stats()).count,
        });
      */
      try {
        await mediaDb?.db.collection(tempId + '.chunks').drop();
      } catch {}
      try {
        await mediaDb?.db.collection(tempId + '.files').drop();
      } catch {}
      // await bucket.drop();
      await sleep(3);
    }
  }
};

// 👇 check post or message body exist after media is uploaded
export const uploadCheck = async (args: {
  type: UploadType;
  identifier: string;
  userId: string;
  cancelUpload: () => void;
}) => {
  const { type, identifier, userId, cancelUpload } = args;

  try {
    await socket.del(identifier);
    await socket.setex(identifier, expire5mins, type);
    // 👇 check post or message reference to upload exist after 5 mins
    await sleep(secsToMs(expire5mins));

    if (type === UploadType.MESSAGE_IMAGE || type === UploadType.MESSAGE_MEDIA) {
      const message = await entityManager.findOne(Message, {
        relations: {
          from: true,
        },
        where: { id: identifier, from: { id: userId } },
      });
      if (!message) {
        cancelUpload();
      }
    } else {
      const post = await entityManager.findOne(Post, {
        relations: {
          parent: true,
        },
        where: {
          id: identifier,
          createdBy: { id: userId },
        },
      });
      if (!post) {
        cancelUpload();
      } else if (type === UploadType.REPLY_IMAGE || (type === UploadType.REPLY_MEDIA && !post.parent)) {
        // 👇 delete reply with no reference to a post
        await entityManager.delete(Post, { id: identifier });
        cancelUpload();
      }
    }
  } catch (error) {
    cancelUpload();
  }
};

export const uploadError = (error: any, res: Response) => {
  const { code, message } = error as MulterError & Error;
  const response = res.status(400).json({
    code: code || ResponseCode.GENERIC_ERROR,
    message,
  });
  if (testing) {
    // 👇 no destroy to prevent 'write EPIPE' error
    return response;
  } else {
    // 👇 destroy request to prevent subsequent file upload
    return response.destroy(Error('ok'));
  }
};

export const uploadProgress = (req: Request, res: Response, next: NextFunction) => {
  const fileSize = Number(req.headers['content-length']) || 0;
  let totalSize = 0;
  // 👇 initialize multer variables if not initialized by previous middleware
  req.multer = req.multer || {};
  // 👇 set event listener
  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    /*
      console.log({
        percentage: ((100 * totalSize) / fileSize).toFixed(2),
        prevChunk: formatBytes(totalSize),
        file_size: formatBytes(fileSize),
      });
     */
  });

  next();
};

// 👇 mongo database connection helper
export const mongoConnect = async () => {
  const connect = (db: string) =>
    new Promise<mongoose.Connection>((resolve, reject) => {
      const connection = mongoose.createConnection(mongoUrl(db), {
        serverSelectionTimeoutMS: 3000,
        // socketTimeoutMS: 3000,
        // heartbeatFrequencyMS: 3000,
        keepAlive: true,
      });

      connection.once('open', () => {
        console.log(`Connected to MongoDB(db:${db})`);
        resolve(connection);
      });

      connection.on('error', (err) => {
        console.log(`Waiting for MongoDB(db:${db})`);
        connection.destroy().then(() => reject());
      });

      connection.on('disconnected', () => {
        // console.log(`Disconnected MongoDB(db:${db})`);
      });
    });

  const recreate = async (connection: mongoose.Connection) => {
    const db = connection.db.databaseName;
    console.log(`Waiting for MongoDB(db:${db})`);
    connection.destroy().then(() => reconnect(db));
  };

  const reconnect = async (db: string) => {
    try {
      const connection = await connect(db);
      // 👇 no reconnection if testing
      if (testing) {
        return;
      }
      connection.on('disconnected', () => recreate(connection)).on('error', () => recreate(connection));
    } catch (error) {
      // 👇 fail test on first error connecting to mongo database
      if (testing) {
        throw new Error(testDbConnectionFailed);
      }
      reconnect(db);
    }
  };

  for (const db in mongoDbs) {
    await reconnect(mongoDbs[db as keyof typeof mongoDbs]);
  }

  // 👇 connect to all mongo databases defined in 'mongoDbs'
  // Object.values(mongoDbs).forEach((db) => reconnect(db));

  /*
  const mongoUrl = mongoUrl(MONGO_INITDB_DATABASE);

  const connect = () =>
    mongoose
      .connect(mongoUrl, {
        // socketTimeoutMS: 3000,
        // heartbeatFrequencyMS: 3000,
        serverSelectionTimeoutMS: 3000,
      })
      .catch(() => undefined);

  mongoose.connection.on('connected', () => console.log('Connected to MongoDB'));
  mongoose.connection.on('disconnected', () => console.log('Waiting for MongoDB'));
  mongoose.connection.on('error', () => connect());

  connect();
*/
};

// 👇 postgres database connection helper
export const postgresConnect = async (connected = true, interval = 0) => {
  // 👇 reconnect or check connection every 3 secs
  if (interval > 0) {
    await sleep(interval);
  } else {
    interval = 3;
  }
  try {
    if (dataSource.isInitialized) {
      // 👇  Keep alive workaround
      try {
        await entityManager.query('SELECT 1');
      } catch {
        await dataSource.driver.connect();
      }
    } else {
      await dataSource.initialize();
    }
    if (connected) {
      console.log(`Connected to PostgresDB(db:${dataSource.driver.database})`);
    }
    if (!testing) {
      postgresConnect(false, interval);
    }
  } catch (error) {
    // 👇 fail test on first error postgres to redis client
    if (testing) {
      throw new Error(testDbConnectionFailed);
    } else {
      console.log('Waiting for PostgresDB');
      postgresConnect(false, interval);
    }
  }
};

// 👇 get session for websocket
export const wsSession = (req: Request) =>
  new Promise<Express.User | undefined>((resolve) => {
    const res = {} as Response;
    const user = auth(req);

    if (user) {
      resolve(user);
    } else {
      // 👇 use same session parser
      session(req, res, () => {
        passportInit(req, res, () => {
          passportSession(req, res, () => {
            resolve(auth(req));
          });
        });
      });
    }
  });

export const randomWords = () =>
  faker.random.words(
    faker.datatype.number({
      min: 3,
      max: 10,
    }),
  );

export const createPost = async (
  user: User,
  save = true,
  args?: Partial<{
    media: string;
    likes: User[];
    parent: Post;
    createdDate: Date;
  }>,
) => {
  const post = new Post({
    id: faker.helpers.unique(faker.datatype.uuid),
    body: randomWords(),
    createdBy: user,
    stats: {
      likes: 0,
      comments: 0,
      liked: 0,
    },
    likes: [],
    parent: args?.parent,
    media: args?.media,
    createdDate: args?.createdDate,
  });

  if (save) {
    await entityManager.insert(Post, post);
    const likes = args?.likes;
    if (likes) {
      likes.forEach((like) => post.likes.push({ id: like.id }));
      await entityManager.save(Post, post);
    }
  }

  return post;
};

export const createMessage = async (
  from: User,
  to: User,
  save = true,
  args?: Partial<{
    missed: boolean;
    deleted: boolean;
    media: string;
    createdDate: Date;
  }>,
) => {
  const missed = args?.missed;

  const message = new Message({
    id: faker.helpers.unique(faker.datatype.uuid),
    from,
    to,
    body: missed ? missedVideoCall : randomWords(),
    missed,
    media: args?.media,
    deleted: args?.deleted,
    createdDate: args?.createdDate,
  });

  if (save) {
    await entityManager.insert(Message, message);
  }

  return message;
};

export const createUser = async (
  save = true,
  args?: Partial<{
    username: string;
    password: string;
    name: string;
    createdDate: Date;
    gender: Gender;
    auth: AuthType;
    active: Date;
  }>,
) => {
  const user = new User({
    id: faker.helpers.unique(faker.datatype.uuid),
    username: args?.username || faker.helpers.unique(faker.random.alphaNumeric, [5]),
    email: faker.helpers.unique(faker.internet.email, []),
    name: args?.name || faker.helpers.unique(faker.name.fullName),
    password: args?.password || faker.internet.password(6),
    createdDate: args?.createdDate,
    gender: args?.gender,
    auth: args?.auth || AuthType.PASSWORD,
    active: args?.active,
  });

  if (save) {
    const password = user.password;
    // 👇 updates the 'createUser' with saved values from database
    await entityManager.save(User, user);
    user.password = password;
    /*
    if (testing) {
      expect(user.notification).toBeTruthy();
    }
    */
  }
  /*
  if (testing) {
    expect(user.bio).toBeFalsy();
    expect(user.active).toBeFalsy();
  }
  */

  return user;
};

export const bulkUsers = async (total: number, name?: string, users?: User[]) => {
  users = users || [];
  for (let i = 0; i < total; i++) {
    const dayOffset = msOneDay * i;
    const createdDate = new Date(testTime - dayOffset);
    users.push(await createUser(false, { name, createdDate }));
  }
  await entityManager.createQueryBuilder().insert().into(User).values(users).execute();

  return users;
};

export const bulkUserFollowing = async (user: User, total: number, users?: User[]) => {
  users = users || (await bulkUsers(total));

  user.following = [];
  for (let i = 0; i < total; i++) {
    user.following.push(users[i]);
  }
  await user.save();

  return users;
};

export const bulkUserFollowers = async (user: User, total: number, users?: User[]) => {
  users = users || (await bulkUsers(total));

  let ids = '';
  users.forEach((user, index) => {
    const id = "'" + user.id + "'";
    const split = index === total - 1 ? '' : ', ';
    ids += id + split;
  });

  if (!users.length) {
    return users;
  }

  await entityManager.query(
    `INSERT INTO followers ("user", "following")
    ${entityManager
      .createQueryBuilder(User, 'user')
      .select('user.id', 'user')
      .addSelect(`'${user.id}'`, 'following')
      .where(`user.id IN (${ids})`)
      .getQuery()}
    `,
  );

  return users;
};

export const bulkUserPosts = async (
  user: User,
  total: number,
  args?: Partial<{
    clear: boolean;
    media: string;
    parent: Post;
    likes: User[];
  }>,
) => {
  const parent = args?.parent;
  const likes = args?.likes;

  if (args?.clear) {
    // 👇 cascade delete
    await entityManager.delete(Post, parent ? { parent } : {});
  }
  const posts: Post[] = [];
  let ids = '';
  for (let i = 0; i < total; i++) {
    const dayOffset = msOneDay * i;
    const createdDate = new Date(testTime - dayOffset);
    posts.push(
      await createPost(user, false, {
        createdDate,
        media: args?.media,
        parent,
      }),
    );
    if (!likes) {
      continue;
    }
    const id = "'" + posts[i].id + "'";
    const split = i === total - 1 ? '' : ', ';
    ids += id + split;
  }

  await entityManager.createQueryBuilder().insert().into(Post).values(posts).execute();

  if (likes) {
    for (const like of likes) {
      await entityManager.query(
        `INSERT INTO likes ("postId", "userId")
        ${entityManager
          .createQueryBuilder(Post, 'post')
          .select('post.id', 'postId')
          .addSelect(`'${like.id}'`, 'userId')
          .where(`post.id IN (${ids})`)
          .getQuery()}
        `,
      );
    }
  }

  return posts;
};

export const bulkUserMessages = async (
  from: User,
  to: User[],
  total: number,
  args?: Partial<{
    clear: boolean;
    missed: boolean;
    deleted: boolean;
    media: string;
    startTime: number;
  }>,
) => {
  if (args?.clear) {
    // 👇 cascade delete
    await entityManager.delete(Message, {});
  }
  const messages: Message[] = [];
  let startTime = args?.startTime || testTime;

  /*
    Sending message to users [A, B]:
    from -> A
    from -> B
    from -> A
    from -> B
    .
    .
    .
  */
  for (let i = 0, days = 0; i < total; i++) {
    for (const user of to) {
      startTime += msOneDay;
      const createdDate = new Date(startTime);
      messages.push(
        await createMessage(from, user, false, {
          createdDate,
          media: args?.media,
          deleted: args?.deleted,
          missed: args?.missed,
        }),
      );
    }
  }
  await entityManager.createQueryBuilder().insert().into(Message).values(messages).execute();

  return { startTime, messages };
};
