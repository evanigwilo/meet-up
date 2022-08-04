// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
import Post from '../entity/Post';
import Message from '../entity/Message';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Node
import { IncomingHttpHeaders } from 'http';
// 👇 Constants, Helpers & Types
import { getMediaFile, mongoGetDb } from '../helpers';
import * as helpers from '../helpers';
import * as constants from '../constants';
import { MediaSchema, MessageInput, PostInput } from '../types';
import { ResponseCode, NotificationType, UploadType, ModelType, MediaCategory } from '../types/enum';
import {
  useTestServer,
  graphQLRequest,
  loginUser,
  testSuccess,
  authenticateUser,
  resolved,
  expectImageFile,
  expectImageSuccess,
  uploadImageFile,
  wsToken,
  expectMediaSuccess,
  httpRequest,
  uploadMediaFile,
} from './helpers';

// 👇 PREVENT DELETE OF UPLOADS WITH NO REFERENCE AFTER UPLOAD
let spyUploadCheck = jest.spyOn(helpers, 'uploadCheck').mockImplementation(resolved);
const spySleep = jest.spyOn(helpers, 'sleep').mockImplementation(resolved);
// 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
const spyCreateNotification = jest.spyOn(helpers, 'createNotification').mockImplementation(resolved);

const mediaType = ['audio', 'video'] as const;
const categories = Object.values(MediaCategory);

// 👇 server start & stop hook
useTestServer({
  afterAll: () => {
    spySleep.mockRestore();
    spyCreateNotification.mockRestore();
  },
});

const expectMediaFile = async (
  mediaDb: mongoose.Connection | undefined,
  filename: string,
  user: User,
  category: Exclude<MediaCategory, MediaCategory.AVATAR>,
  exist = true,
) => {
  const mediaFile = await getMediaFile(mediaDb, filename, {
    filename,
    'metadata.userId': user.id,
    'metadata.category': category,
  });
  if (exist) {
    expect(mediaFile).toMatchObject<Partial<MediaSchema>>({
      _id: expect.any(mongoose.Types.ObjectId),
      filename,
      metadata: expect.objectContaining<Partial<MediaSchema['metadata']>>({
        userId: user.id,
        username: user.username,
        auth: user.auth,
        category,
      }),
    });
  } else {
    expect(mediaFile).toBe(null);
  }

  return mediaFile;
};

const postWithFile = async (
  user: User,
  headers: IncomingHttpHeaders,
  id: string,
  type: 'image' | 'video' | 'audio',
) => {
  const post = await helpers.createPost(user, false);
  const postInput: Partial<PostInput> = {
    id,
    body: post.body,
  };
  const request = await graphQLRequest<Post>('createPost', { postInput }, headers);
  testSuccess(request);
  expect(request.body).toMatchObject<Partial<Post>>({
    id: postInput.id,
    createdBy: expect.objectContaining<Partial<User>>({
      id: user.id,
    }),
    body: postInput.body,
    media: expect.stringContaining(type),
    parent: null,
  });
};

const postUploadCheck = async (
  user: User,
  identifier: string,
  type: Exclude<UploadType, UploadType.MESSAGE_IMAGE | UploadType.MESSAGE_MEDIA>,
) => {
  const cancelUpload = jest.fn();
  const args = {
    type,
    identifier,
    userId: user.id,
    cancelUpload: () => cancelUpload(),
  };
  spyUploadCheck.mockRestore();
  // 👇 POST REFERENCE TO UPLOAD EXIST
  await helpers.uploadCheck({ ...args });
  expect(cancelUpload).toHaveBeenCalledTimes(0);

  // 👇 POST REFERENCE TO UPLOAD IS A COMMENT
  await helpers.uploadCheck({
    ...args,
    type: type === UploadType.POST_IMAGE ? UploadType.REPLY_IMAGE : UploadType.REPLY_MEDIA,
  });
  expect(cancelUpload).toHaveBeenCalledTimes(1);

  // 👇 POST REFERENCE TO UPLOAD DOES NOT EXIST
  await helpers.uploadCheck({ ...args, identifier: faker.datatype.uuid() });
  expect(cancelUpload).toHaveBeenCalledTimes(2);
  spyUploadCheck = jest.spyOn(helpers, 'uploadCheck').mockImplementation(resolved);
};

const messageWithFile = async (
  user: User,
  headers: IncomingHttpHeaders,
  id: string,
  type: 'image' | 'video' | 'audio',
) => {
  const to = await helpers.createUser();
  const message = await helpers.createMessage(user, to, false);
  const messageInput: MessageInput = {
    id,
    body: message.body,
    to: to.id,
  };
  const messageRequest = await graphQLRequest<Message>('sendMessage', { messageInput }, headers);
  testSuccess(messageRequest);
  expect(messageRequest.body).toMatchObject<Partial<Message>>({
    id: messageInput.id,
    from: expect.objectContaining<Partial<User>>({
      id: user.id,
    }),
    to: expect.objectContaining<Partial<User>>({
      id: to.id,
    }),
    body: messageInput.body,
    media: expect.stringContaining(type),
    missed: false,
    deleted: false,
  });
};

const messageUploadCheck = async (
  user: User,
  identifier: string,
  type: Extract<UploadType, UploadType.MESSAGE_IMAGE | UploadType.MESSAGE_MEDIA>,
) => {
  const cancelUpload = jest.fn();
  const args = {
    type,
    identifier,
    userId: user.id,
    cancelUpload: () => cancelUpload(),
  };
  spyUploadCheck.mockRestore();
  // 👇 MESSAGE REFERENCE TO UPLOAD EXIST
  await helpers.uploadCheck({ ...args });
  expect(cancelUpload).toHaveBeenCalledTimes(0);

  // 👇 MESSAGE REFERENCE TO UPLOAD DOES NOT EXIST
  await helpers.uploadCheck({ ...args, identifier: faker.datatype.uuid() });
  expect(cancelUpload).toHaveBeenCalledTimes(1);
  spyUploadCheck = jest.spyOn(helpers, 'uploadCheck').mockImplementation(resolved);
};

const testUploadSize = async (callback: () => Promise<void>) => {
  const maxUploadSize = { ...constants.maxUploadSize };
  Object.defineProperty(constants, 'maxUploadSize', {
    value: {
      image: -1,
      media: -1,
    },
    writable: true,
  });
  await callback();
  Object.defineProperty(constants, 'maxUploadSize', { value: maxUploadSize, writable: true });
};

describe('MimeTypes', () => {
  it('should get supported mime types for uploads', async () => {
    const request = await graphQLRequest<Message[]>('getMimeTypes');
    testSuccess(request);
    expect(request.body).toEqual(constants.mimeTypes);
  });
});

describe('Image Upload', () => {
  it('should upload, get and delete image successfully', async () => {
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    user = await authenticateUser(headers);

    const categoryToUpload = {
      [MediaCategory.MESSAGE]: UploadType.MESSAGE_IMAGE,
      [MediaCategory.POST]: UploadType.POST_IMAGE,
      [MediaCategory.REPLY]: UploadType.REPLY_IMAGE,
    };

    const categoryToModel = {
      [MediaCategory.MESSAGE]: ModelType.MESSAGE,
      [MediaCategory.POST]: ModelType.POST,
      [MediaCategory.REPLY]: ModelType.REPLY,
      [MediaCategory.AVATAR]: ModelType.AVATAR,
    };
    spyCreateNotification.mockClear();

    const imageDb = mongoGetDb('image');
    // 👇 Upload, Get and Delete image for all possible categories
    for (const category of categories) {
      const categoryAvatar = category === MediaCategory.AVATAR;
      const modelType = categoryToModel[category];
      const imageId = categoryAvatar ? user.id : await wsToken(user, categoryToUpload[category]);
      const getRoute = `/image/${category}/${imageId}`;
      const postDeleteRoute = categoryAvatar ? `/image/${category}` : getRoute;
      spyUploadCheck.mockClear();
      // 👇 Upload image
      let request = await httpRequest('POST', postDeleteRoute, headers, 'image');
      expectImageSuccess(request);
      if (categoryAvatar) {
        expect(spyUploadCheck).toHaveBeenCalledTimes(0);
      } else {
        // 👇 upload checker interval should have been called
        expect(spyUploadCheck).toHaveBeenCalledTimes(1);
        expect(spyUploadCheck).toHaveBeenCalledWith({
          type: categoryToUpload[category],
          identifier: imageId,
          userId: user.id,
          cancelUpload: expect.any(Function),
        });
      }
      spyUploadCheck.mockClear();
      // 👇 Get image
      request = await httpRequest('GET', getRoute, headers);
      expectImageSuccess(request, true);

      // 👇 verify the image file should exist
      await expectImageFile(imageDb, modelType, imageId, user);
      // 👇 Get not found image
      request = await httpRequest('GET', `/image/${category}/${faker.datatype.uuid()}`, headers);
      expectImageSuccess(request, true);
      // 👇 Get profile image using username and auth route
      if (categoryAvatar) {
        request = await httpRequest('GET', `/image/${category}/${user.auth}/${user.username}`, headers);
        expectImageSuccess(request, true);
        // 👇 verify the image file should exist
        await expectImageFile(imageDb, modelType, imageId, user);
      }
      // 👇 Delete image
      request = await httpRequest('DELETE', postDeleteRoute, headers);
      expectImageSuccess(request);
      // 👇 verify the image file should not exist
      await expectImageFile(imageDb, modelType, imageId, user, false);
    }
    // 👇 uploading profile photo should have notified user
    expect(spyCreateNotification).toHaveBeenCalledTimes(1);
    expect(spyCreateNotification).toHaveBeenCalledWith(
      NotificationType.PROFILE_UPDATE,
      expect.objectContaining<Partial<User>>({
        id: user.id,
      }),
      `${user.auth}/${user.username}`,
      expect.objectContaining<Partial<User>>({
        id: user.id,
      }),
    );
  });

  it('should upload image with errors', async () => {
    // 👇 UNAUTHENTICATED
    let request = await httpRequest('POST', '/image/post');
    expect(request.body).toMatchObject({ code: ResponseCode.UNAUTHENTICATED });
    expect(request.status).toEqual(400);

    // 👇 INVALID IMAGE CATEGORY
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    request = await httpRequest('POST', '/image/books', headers);
    expect(request.body).toMatchObject({ code: ResponseCode.IMAGE_CATEGORY_INVALID });
    expect(request.status).toEqual(400);

    // 👇 NO POST ID PARAMETERS
    request = await httpRequest('POST', '/image/post', headers);
    expect(request.body).toMatchObject({ code: ResponseCode.IMAGE_ID_INVALID });
    expect(request.status).toEqual(400);

    // 👇 INVALID POST ID PARAMETERS
    request = await httpRequest('POST', '/image/post/' + faker.datatype.uuid(), headers);
    expect(request.body).toMatchObject({ code: ResponseCode.IMAGE_ID_INVALID });
    expect(request.status).toEqual(400);

    // 👇 ID SUPPLIED FOR PROFILE UPDATE (USES USER ID AFTER AUTHENTICATION, NO NEED TO SUPPLY ID)
    request = await httpRequest('POST', '/image/avatar/' + faker.datatype.uuid(), headers);
    expect(request.body).toMatchObject({ code: ResponseCode.IMAGE_ID_INVALID });
    expect(request.status).toEqual(400);

    // 👇 GET VALID IMAGE ID
    user = await authenticateUser(headers);
    const imageId = await wsToken(user, UploadType.POST_IMAGE);

    // 👇 INVALID IMAGE MIMETYPE
    request = await httpRequest('POST', '/image/post/' + imageId, headers, 'image', 'video');
    expect(request.body).toMatchObject({ code: ResponseCode.INVALID_MIMETYPE });
    expect(request.status).toEqual(400);

    // 👇 FILE MISSING OR INVALID FILENAME FIELD IN MULTIPART FORM DATA
    request = await httpRequest('POST', '/image/post/' + imageId, headers, 'video');
    expect(request.body).toMatchObject({ code: ResponseCode.FILE_MISSING });
    expect(request.status).toEqual(400);

    // 👇 FILE SIZE EXCEEDS LIMITS
    await testUploadSize(async () => {
      request = await httpRequest('POST', '/image/post/' + imageId, headers, 'image');
      expect(request.body).toMatchObject({ code: ResponseCode.MAX_FILE_SIZE });
      expect(request.status).toEqual(400);
    });
  });

  it('should delete canceled image uploads', async () => {
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    user = await authenticateUser(headers);

    // 👇 canceled uploads variable
    const canceledUploads: string[] = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      const imageId = await wsToken(user, UploadType.POST_IMAGE);
      const request = await httpRequest('POST', '/image/post/' + imageId, headers, 'image');
      expectImageSuccess(request);
      canceledUploads.push(imageId);
    }
    expect(canceledUploads).toHaveLength(count);

    const imageDb = mongoGetDb('image');
    // 👇 verify canceled uploads exists in database
    for (const imageId of canceledUploads) {
      // 👇 verify the image file should exist
      await expectImageFile(imageDb, ModelType.POST, imageId, user);
    }

    await helpers.deleteCanceledImageUploads(ModelType.POST, [...canceledUploads]);
    // expect(spySleep).toHaveBeenCalledTimes(count * deleteIterations);

    // 👇 verify canceled uploads does no exist in database
    for (const imageId of canceledUploads) {
      // 👇 verify the image file should not exist
      await expectImageFile(imageDb, ModelType.POST, imageId, user, false);
    }
  });

  it('should check post or message body exist after successful upload', async () => {
    let upload = await uploadImageFile(UploadType.POST_IMAGE, MediaCategory.POST);
    await postWithFile(upload.user, upload.headers, upload.imageId, 'image');
    await postUploadCheck(upload.user, upload.imageId, UploadType.POST_IMAGE);

    upload = await uploadImageFile(UploadType.MESSAGE_IMAGE, MediaCategory.MESSAGE);
    await messageWithFile(upload.user, upload.headers, upload.imageId, 'image');
    await messageUploadCheck(upload.user, upload.imageId, UploadType.MESSAGE_IMAGE);
  });
});

describe('Media Upload', () => {
  it('should upload, get and delete media successfully', async () => {
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    user = await authenticateUser(headers);

    const categoryToUpload = {
      [MediaCategory.MESSAGE]: UploadType.MESSAGE_MEDIA,
      [MediaCategory.POST]: UploadType.POST_MEDIA,
      [MediaCategory.REPLY]: UploadType.REPLY_MEDIA,
    };

    const mediaDb = mongoGetDb('media');
    spyCreateNotification.mockClear();
    // 👇 Upload, Get and Delete media for all possible categories
    for (const category of categories) {
      if (category === MediaCategory.AVATAR) {
        continue;
      }
      const uploadType = categoryToUpload[category];
      // 👇 audio and video check
      for (const media of mediaType) {
        const mediaId = await wsToken(user, uploadType);
        const route = `/media/${category}/${mediaId}`;
        spyUploadCheck.mockClear();
        // 👇 Upload video or audio
        let request = await httpRequest('POST', route, headers, media);
        expectMediaSuccess(request, media);
        // 👇 upload checker interval should have been called
        expect(spyUploadCheck).toHaveBeenCalledTimes(1);
        expect(spyUploadCheck).toHaveBeenCalledWith({
          type: uploadType,
          identifier: mediaId,
          userId: user.id,
          cancelUpload: expect.any(Function),
        });
        spyUploadCheck.mockClear();
        // 👇 Get video or audio
        request = await httpRequest('GET', route, headers);
        expectMediaSuccess(request, media, true);
        // 👇 verify the video or audio file should exist
        await expectMediaFile(mediaDb, mediaId, user, category);
        const invalidRoute = `/media/${category}/${faker.datatype.uuid()}`;
        // 👇 return error for get invalid media
        request = await httpRequest('GET', invalidRoute, headers);
        expect(request.body).toMatchObject({ code: ResponseCode.MEDIA_INVALID });
        expect(request.status).toEqual(400);
        // 👇 return error for delete invalid media
        request = await httpRequest('DELETE', invalidRoute, headers);
        expect(request.body).toMatchObject({ code: ResponseCode.FAILED });
        expect(request.status).toEqual(400);
        // 👇 Delete video or audio
        request = await httpRequest('DELETE', route, headers);
        // 👇 verify the video or audio file should not exist
        await expectMediaFile(mediaDb, mediaId, user, category, false);
      }
    }
    expect(spyCreateNotification).toHaveBeenCalledTimes(0);
  });

  it('should upload media with errors', async () => {
    const id = faker.datatype.uuid();
    const invalidId = '/media/post/' + id;
    const invalidCategory = '/media/books/' + id;
    // 👇 UNAUTHENTICATED
    let request = await httpRequest('POST', invalidId);
    expect(request.body).toMatchObject({ code: ResponseCode.UNAUTHENTICATED });
    expect(request.status).toEqual(400);

    // 👇 INVALID MEDIA CATEGORY
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    request = await httpRequest('POST', invalidCategory, headers);

    expect(request.body).toMatchObject({ code: ResponseCode.MEDIA_CATEGORY_INVALID });
    expect(request.status).toEqual(400);

    // 👇 INVALID POST ID PARAMETERS
    request = await httpRequest('POST', invalidId, headers);
    expect(request.body).toMatchObject({ code: ResponseCode.MEDIA_ID_INVALID });
    expect(request.status).toEqual(400);

    user = await authenticateUser(headers);
    // 👇 GET VALID MEDIA ID
    let mediaId = await wsToken(user, UploadType.POST_MEDIA);
    // 👇 FILE MISSING OR INVALID FILENAME FIELD IN MULTIPART FORM DATA
    request = await httpRequest('POST', '/media/post/' + mediaId, headers, 'image');
    expect(request.body).toMatchObject({ code: ResponseCode.FILE_MISSING });
    expect(request.status).toEqual(400);
    // 👇 audio and video check
    for (const media of mediaType) {
      mediaId = await wsToken(user, UploadType.POST_MEDIA);

      // 👇 INVALID MEDIA MIMETYPE
      request = await httpRequest('POST', '/media/post/' + mediaId, headers, media, 'image');
      expect(request.body).toMatchObject({ code: ResponseCode.INVALID_MIMETYPE });
      expect(request.status).toEqual(400);

      // 👇 MEDIA EXISTS
      const mediaFile = await uploadMediaFile(UploadType.POST_MEDIA, MediaCategory.POST, media);
      request = await httpRequest('POST', '/media/post/' + mediaFile.mediaId, headers, media);
      expect(request.body).toMatchObject({ code: ResponseCode.MEDIA_EXISTS });
      expect(request.status).toEqual(400);

      // 👇 FILE SIZE EXCEEDS LIMITS
      await testUploadSize(async () => {
        request = await httpRequest('POST', '/media/post/' + mediaId, headers, media);
        expect(request.body).toMatchObject({ code: ResponseCode.MAX_FILE_SIZE });
        expect(request.status).toEqual(400);
      });
    }
  });

  it('should delete canceled media uploads', async () => {
    let user = await helpers.createUser();
    const headers = await loginUser(user);
    user = await authenticateUser(headers);

    // 👇 canceled uploads variable
    const canceledUploads: string[] = [];
    const count = 3;
    const mediaDb = mongoGetDb('media');
    // 👇 audio and video check
    for (const media of mediaType) {
      canceledUploads.length = 0;
      for (let i = 0; i < count; i++) {
        const mediaId = await wsToken(user, UploadType.POST_MEDIA);
        const request = await httpRequest('POST', '/media/post/' + mediaId, headers, media);
        expectMediaSuccess(request, media);
        canceledUploads.push(mediaId);
      }
      expect(canceledUploads).toHaveLength(count);
      // 👇 verify canceled uploads exists in database
      for (const mediaId of canceledUploads) {
        // 👇 verify the media file should exist
        await expectMediaFile(mediaDb, mediaId, user, MediaCategory.POST);
      }
      await helpers.deleteCanceledMediaUploads([...canceledUploads]);
      // 👇 verify canceled uploads does no exist in database
      for (const mediaId of canceledUploads) {
        // 👇 verify the media file should not exist
        await expectMediaFile(mediaDb, mediaId, user, MediaCategory.POST, false);
      }
    }
  });

  it('should check post or message body exist after successful upload', async () => {
    for (const media of mediaType) {
      let upload = await uploadMediaFile(UploadType.POST_MEDIA, MediaCategory.POST, media);
      await postWithFile(upload.user, upload.headers, upload.mediaId, media);
      await postUploadCheck(upload.user, upload.mediaId, UploadType.POST_MEDIA);

      upload = await uploadMediaFile(UploadType.MESSAGE_MEDIA, MediaCategory.MESSAGE, media);
      await messageWithFile(upload.user, upload.headers, upload.mediaId, media);
      await messageUploadCheck(upload.user, upload.mediaId, UploadType.MESSAGE_MEDIA);
    }
  });
});
