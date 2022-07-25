// 👇 Node
import path from 'path';
import { randomInt } from 'crypto';
import { createReadStream, readFileSync } from 'fs';
// 👇 Typeorm
import { MigrationInterface, QueryRunner } from 'typeorm';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Models
import * as Models from '../models/Image';
// 👇 Entities
import User from '../entity/User';
import Post from '../entity/Post';
// 👇 Constants, Helpers & Types
import { imagesPath, mediaPath, testDate } from '../constants';
import { Gender, MediaCategory } from '../types/enum';
import {
  dataSource,
  formatBytes,
  createPost,
  bulkUserFollowing,
  bulkUserMessages,
  bulkUserPosts,
  bulkUsers,
  createUser,
  randomWords,
  mongoGetDb,
} from '../helpers';

// 👇 possible images
const imageNames = ['Lake-Water.jpg', 'Landscape-Color.jpg', 'The-5th-Wave.jpg'];
const imageBuffers = imageNames.map((image) => readFileSync(path.join(__dirname, `${imagesPath}/sample`, image)));

// 👇 Randomize array in-place using Durstenfeld shuffle algorithm
const shuffleArray = <T>(array: T[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

const createImage = async (user: Partial<User>, filename: string, category: MediaCategory, buffer: Buffer) => {
  const model =
    category === MediaCategory.POST
      ? Models.Post()
      : category === MediaCategory.REPLY
      ? Models.Reply()
      : category === MediaCategory.MESSAGE
      ? Models.Message()
      : Models.Avatar();
  const { id: userId, username, email, auth } = user;
  const contentType = 'image/jpeg';
  await model?.create({
    filename,
    metadata: {
      userId,
      username,
      email,
      auth,
    },
    image: {
      data: buffer,
      contentType,
      size: formatBytes(buffer.length),
    },
  });
};

const createMedia = async (
  user: Partial<User>,
  filename: string,
  category: MediaCategory,
  media: 'audio' | 'video',
) => {
  // 👇 save random media to database
  const bucket = new mongoose.mongo.GridFSBucket(mongoGetDb('media')!.db, {
    bucketName: filename,
    chunkSizeBytes: 256000, // 256kb
  });
  const { id: userId, username, email, auth } = user;
  const contentType = media === 'audio' ? 'audio/mpeg' : 'video/webm';
  // 👇 writable stream for writing buffers to GridFS
  const writeStream = bucket.openUploadStream(filename, {
    contentType,
    metadata: {
      userId,
      category,
      username,
      email,
      auth,
    },
  });
  // 👇 read stream for media file and write the stream to the GridFS writable stream
  const stream = createReadStream(path.join(__dirname, mediaPath, media === 'audio' ? 'audio.mp3' : 'video.webm')).pipe(
    writeStream,
  );
  // 👇 wait for writable stream to finish
  await new Promise<void>((resolve, reject) => {
    stream
      .on('finish', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

const postsWithBody = async (
  user: User,
  args?: Partial<{
    likes: User[];
    parent: Post;
  }>,
) => {
  const total = randomInt(1, 3);
  await bulkUserPosts(user, total, {
    likes: args?.likes,
    parent: args?.parent,
  });
};

const postsWithImage = async (
  user: User,
  args?: Partial<{
    likes: User[];
    parent: Post;
  }>,
) => {
  const total = randomInt(1, 3);
  const contentType = 'image/jpeg';
  const posts = await bulkUserPosts(user, total, {
    media: contentType,
    likes: args?.likes,
    parent: args?.parent,
  });

  for (const post of posts) {
    // 👇 save image to database
    const imageIndex = randomInt(0, imageNames.length);
    const buffer = imageBuffers[imageIndex];
    const category = args?.parent ? MediaCategory.REPLY : MediaCategory.POST;
    await createImage(user, post.id, category, buffer);
  }
};

const postsWithMedia = async (
  user: User,
  media: 'audio' | 'video',
  args?: Partial<{
    likes: User[];
  }>,
) => {
  const total = randomInt(1, 3);
  const contentType = media === 'audio' ? 'audio/mpeg' : 'video/webm';
  const posts = await bulkUserPosts(user, total, {
    media: contentType,
    likes: args?.likes,
  });

  for (const post of posts) {
    // 👇 save media to database
    await createMedia(user, post.id, MediaCategory.POST, media);
  }
};
const pickUsers = (users: User[], skip?: User) => {
  const selected = shuffleArray(users.filter((user) => user.id !== skip?.id));
  const total = randomInt(selected.length);
  return selected.slice(0, total);
};

export class SampleData1656633600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 👇 synchronize to create schema and relations
    await dataSource.synchronize();
    // 👇 sample user default password
    const password = '123456';
    // 👇 create conversation users
    const mark = await createUser(false, {
      name: 'Mark Grey',
      username: 'mark',
      password,
      gender: Gender.MALE,
      createdDate: testDate,
      active: testDate,
    });
    const jane = await createUser(false, {
      name: 'Jane Austen',
      username: 'jane',
      password,
      gender: Gender.FEMALE,
      createdDate: testDate,
      active: testDate,
    });
    const tom = await createUser(false, {
      name: 'Tom Holland',
      username: 'tom',
      password,
      createdDate: testDate,
      active: testDate,
    });
    // 👇 create 10 users
    const userCount = 10;
    const users = await bulkUsers(userCount - 3, undefined, [mark, jane, tom]);

    // 👇 create avatar for 8 users
    shuffleArray(users);
    for (let i = 0; i < 8; i++) {
      // 👇 save image to database
      const user = users[i];
      const buffer = readFileSync(path.join(__dirname, `${imagesPath}/sample/profiles`, `Profile-${i + 1}.jpg`));
      await createImage(user, user.id, MediaCategory.AVATAR, buffer);
    }
    // 👇 update bio for 8 random users
    shuffleArray(users);
    for (let i = 0; i < 8; i++) {
      const user = users[i];
      await queryRunner.manager.update(User, { id: user.id }, { bio: randomWords() });
    }
    // 👇 sample posts and reply's for 2 random users
    for (let i = 0; i < 2; i++) {
      // 👇 random posts
      let user = users[randomInt(userCount)];
      await postsWithBody(user);
      // 👇 random posts with likes
      user = users[randomInt(userCount)];
      await postsWithBody(user, {
        likes: pickUsers(users),
      });
      // 👇 random posts with image
      user = users[randomInt(userCount)];
      await postsWithImage(user);
      // 👇 random posts with image and likes
      user = users[randomInt(userCount)];
      await postsWithImage(user, {
        likes: pickUsers(users),
      });
      // 👇 random comments
      user = users[randomInt(userCount)];
      let parent = await createPost(user, true, {
        createdDate: testDate,
      });
      await postsWithBody(user, {
        parent,
      });
      // 👇 random comments with likes
      user = users[randomInt(userCount)];
      parent = await createPost(user, true, {
        createdDate: testDate,
      });
      await postsWithBody(user, {
        parent,
        likes: pickUsers(users),
      });
      // 👇 random comments with image and likes
      user = users[randomInt(userCount)];
      parent = await createPost(user, true, {
        createdDate: testDate,
      });
      await postsWithImage(user, {
        parent,
        likes: pickUsers(users),
      });
      // 👇 random posts with audio media and likes
      user = users[randomInt(userCount)];
      await postsWithMedia(user, 'audio', {
        likes: users,
      });
      // 👇 random posts with video media and likes
      user = users[randomInt(userCount)];
      await postsWithMedia(user, 'video', {
        likes: pickUsers(users),
      });
    }
    // 👇 random follow for users
    for (const user of users) {
      const following = pickUsers(users, user);
      await bulkUserFollowing(user, following.length, following);
      /*
        let createUsers = await bulkUsers(randomInt(count));
        await bulkUserFollowers(user, createUsers.length, createUsers);
        // 👇 create sub copy of followers for mutuals
        if (!createUsers.length) {
          continue;
        }
        createUsers = shuffleArray(createUsers).slice(0, randomInt(createUsers.length));
        await bulkUserFollowing(user, createUsers.length, createUsers);
      */
    }

    // 👇 random conversation between users
    const messageCount = 2;
    for (const user of [jane, tom]) {
      // 👇 messaging
      let result = await bulkUserMessages(mark, [user], messageCount);
      result = await bulkUserMessages(user, [mark], messageCount, {
        startTime: result.startTime,
      });
      // 👇 deleted message
      result = await bulkUserMessages(mark, [user], 1, {
        deleted: true,
        startTime: result.startTime,
      });
      // 👇 video message
      let type = 'video/webm';
      result = await bulkUserMessages(mark, [user], 1, {
        media: type,
        startTime: result.startTime,
      });
      for (const message of result.messages) {
        // 👇 save video media to database
        await createMedia(message.from, message.id, MediaCategory.MESSAGE, 'video');
      }
      // 👇 messaging
      result = await bulkUserMessages(mark, [user], messageCount, {
        startTime: result.startTime,
      });
      result = await bulkUserMessages(user, [mark], messageCount, {
        startTime: result.startTime,
      });
      // 👇 deleted message
      result = await bulkUserMessages(user, [mark], 1, {
        deleted: true,
        startTime: result.startTime,
      });
      // 👇 audio message
      type = 'audio/mpeg';
      result = await bulkUserMessages(user, [mark], 1, {
        media: type,
        startTime: result.startTime,
      });
      for (const message of result.messages) {
        // 👇 save audio media to database
        await createMedia(message.from, message.id, MediaCategory.MESSAGE, 'audio');
      }
      // 👇 messaging
      result = await bulkUserMessages(mark, [user], messageCount, {
        startTime: result.startTime,
      });
      result = await bulkUserMessages(user, [mark], messageCount, {
        startTime: result.startTime,
      });
      // 👇 missed call message
      result = await bulkUserMessages(mark, [user], 1, {
        missed: true,
        startTime: result.startTime,
      });
      // 👇 deleted message
      result = await bulkUserMessages(user, [mark], 1, {
        deleted: true,
        startTime: result.startTime,
      });
      // 👇 image message
      type = 'image/jpeg';
      result = await bulkUserMessages(user, [mark], 1, {
        media: type,
        startTime: result.startTime,
      });
      for (const message of result.messages) {
        // 👇 save image to database
        const imageIndex = randomInt(0, imageNames.length);
        const buffer = imageBuffers[imageIndex];
        await createImage(message.from, message.id, MediaCategory.MESSAGE, buffer);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
