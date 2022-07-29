// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
import Post from '../entity/Post';
// 👇 Constants, Helpers & Types
import { PostInput } from '../types';
import { maxLimit } from '../constants';
import * as helpers from '../helpers';
import { ResponseCode, NotificationType, UploadType, MediaCategory } from '../types/enum';
import {
  useTestServer,
  graphQLRequest,
  loginUser,
  testSuccess,
  testError,
  testPagination,
  testUnauthenticated,
  authenticateUser,
  resolved,
  uploadImageFile,
  wsToken,
  uploadMediaFile,
} from './helpers';

// 👇 server start & stop hook
useTestServer();

describe('Posts', () => {
  // 👇 PREVENT DELETE OF UPLOADS WITH NO REFERENCE AFTER UPLOAD
  const spyUploadCheck = jest.spyOn(helpers, 'uploadCheck').mockImplementation(resolved);
  // 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
  const spyCreateNotification = jest.spyOn(helpers, 'createNotification').mockImplementation(resolved);

  beforeEach(() => {
    spyCreateNotification.mockClear();
  });

  afterAll(() => {
    spyUploadCheck.mockRestore();
    spyCreateNotification.mockRestore();
  });

  it('should get posts', async () => {
    const query = 'getPosts';
    let user = await helpers.createUser();
    let posts = await helpers.bulkUserPosts(user, maxLimit, { clear: true });

    const request = await graphQLRequest<Post[]>(query);
    const body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((post, index) => {
      expect(post.createdBy.id).toEqual(posts[index].createdBy.id);
      expect(post.parent).toBeFalsy();
    });

    user = await helpers.createUser();
    posts = await helpers.bulkUserPosts(user, maxLimit * 2, { clear: true });
    await testPagination(query, posts, {});
  });

  it('should get comments', async () => {
    const query = 'getPosts';
    let user = await helpers.createUser();
    const parent = await helpers.createPost(user);
    // 👇 bulk comments with same parent
    let comments = await helpers.bulkUserPosts(user, maxLimit, {
      parent,
      clear: true,
    });

    const request = await graphQLRequest<Post[]>(query, { id: parent.id });
    testSuccess(request);
    const body = request.body;
    expect(body).toHaveLength(maxLimit);
    body?.forEach((comment, index) => {
      expect(comment.createdBy.id).toEqual(comments[index].createdBy.id);
      expect(comment.parent?.id).toEqual(parent.id);
    });

    user = await helpers.createUser();
    comments = await helpers.bulkUserPosts(user, maxLimit * 2, {
      parent,
      clear: true,
    });
    await testPagination(query, comments, { id: parent.id });
  });

  it('should get a post', async () => {
    const query = 'getPost';
    let request = await graphQLRequest<Post>(query, { id: faker.datatype.uuid() });
    testError(request, ResponseCode.FORBIDDEN, query);

    const userA = await helpers.createUser();
    const userB = await helpers.createUser();
    // 👇 UserA created a post that UserB liked
    const post = await helpers.createPost(userA, true, {
      likes: [userB],
    });
    // 👇 UserB creates bulk comments from the above post UserA created
    await helpers.bulkUserPosts(userB, maxLimit, {
      parent: post,
    });

    request = await graphQLRequest<Post>(query, { id: post.id });
    let body = request.body;
    testSuccess(request);

    const output: Partial<Post> = {
      id: post.id,
      createdBy: expect.objectContaining<Partial<User>>({
        id: userA.id,
      }),
      body: post.body,
      media: null,
      parent: null,
      stats: {
        // 👇 UserB liked the post
        likes: 1,
        // 👇 UserB created the comments
        comments: maxLimit,
        // 👇 UserA didn't like the post
        liked: 0,
      },
    };
    expect(body).toMatchObject(output);

    // 👇 login with UserB
    const headers = await loginUser(userB);
    request = await graphQLRequest<Post>(query, { id: post.id }, headers);
    body = request.body;
    testSuccess(request);
    // 👇 stats should return UserB liked the post
    output.stats!.liked = 1;
    expect(body).toMatchObject(output);
  });

  it('should create a post', async () => {
    const query = 'createPost';

    const postInput: Partial<PostInput> = {
      body: '',
    };

    await testUnauthenticated(query, { postInput });

    let user = await helpers.createUser();
    const headers = await loginUser(user);
    let request = await graphQLRequest<Post>(query, { postInput }, headers);
    // 👇 no body error
    testError(request, ResponseCode.INPUT_ERROR, query);

    const { body } = await helpers.createPost(user, false);
    postInput.body = body;

    request = await graphQLRequest<Post>(query, { postInput }, headers);
    // 👇 success creating post
    testSuccess(request);
    const post = request.body as Post;
    expect(post).toMatchObject<Partial<Post>>({
      id: post.id,
      createdBy: expect.objectContaining<Partial<User>>({
        id: user.id,
      }),
      body: post.body,
      media: null,
      parent: null,
      stats: {
        likes: 0,
        comments: 0,
        liked: 0,
      },
    });
    const postExist = await helpers.entityManager.count(Post, {
      where: { id: post.id },
    });
    expect(postExist).toEqual(1);
    // 👇 publish notification for creating post
    expect(spyCreateNotification).toHaveBeenCalledTimes(1);
    expect(spyCreateNotification).toHaveBeenCalledWith(
      NotificationType.POST_CREATE,
      expect.objectContaining<Partial<User>>({
        id: user.id,
      }),
      post.id,
    );

    // 👇 INVALID POST ID
    postInput.id = faker.datatype.uuid();
    request = await graphQLRequest<Post>(query, { postInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 POST ID WITH NO MEDIA FILE REFERENCE
    user = await authenticateUser(headers);
    postInput.id = await wsToken(user, UploadType.POST_MEDIA);
    request = await graphQLRequest<Post>(query, { postInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 POST ID WITH NO IMAGE FILE REFERENCE
    postInput.id = await wsToken(user, UploadType.POST_IMAGE);
    request = await graphQLRequest<Post>(query, { postInput }, headers);
    testError(request, ResponseCode.FORBIDDEN, [query, 'id']);

    // 👇 SUCCESSFUL IMAGE UPLOAD
    const imageFile = await uploadImageFile(UploadType.POST_IMAGE, MediaCategory.POST);
    postInput.id = imageFile.imageId;
    request = await graphQLRequest<Post>(query, { postInput }, imageFile.headers);
    testSuccess(request);
    expect(request.body).toMatchObject<Partial<Post>>({
      id: postInput.id,
      createdBy: expect.objectContaining<Partial<User>>({
        id: imageFile.user.id,
      }),
      body: postInput.body,
      media: expect.stringContaining('image'),
      parent: null,
    });

    // 👇 SUCCESSFUL VIDEO UPLOAD
    const mediaFile = await uploadMediaFile(UploadType.POST_MEDIA, MediaCategory.POST, 'video');
    postInput.id = mediaFile.mediaId;
    request = await graphQLRequest<Post>(query, { postInput }, mediaFile.headers);
    testSuccess(request);
    expect(request.body).toMatchObject<Partial<Post>>({
      id: postInput.id,
      createdBy: expect.objectContaining<Partial<User>>({
        id: mediaFile.user.id,
      }),
      body: postInput.body,
      media: expect.stringContaining('video'),
      parent: null,
    });
  });

  it('should like a post', async () => {
    const query = 'likePost';

    let id = faker.datatype.uuid();

    await testUnauthenticated(query, { id });

    const userA = await helpers.createUser();
    const userB = await helpers.createUser();
    let headers = await loginUser(userA);
    let request = await graphQLRequest<Post>(query, { id }, headers);
    // 👇 invalid post id error
    testError(request, ResponseCode.INPUT_ERROR, query);

    // 👇 no notification, same user liking and creating post
    let post = await helpers.createPost(userA);
    id = post.id;
    request = await graphQLRequest<Post>(query, { id }, headers);
    expect(spyCreateNotification).toHaveBeenCalledTimes(0);

    // 👇 no notification, different user but post is a comment
    post = await helpers.createPost(userA, true, {
      parent: await helpers.createPost(userA),
    });
    id = post.id;
    headers = await loginUser(userB);
    request = await graphQLRequest<Post>(query, { id }, headers);
    expect(spyCreateNotification).toHaveBeenCalledTimes(0);

    post = await helpers.createPost(userA);
    id = post.id;
    request = await graphQLRequest<Post>(query, { id }, headers);
    testSuccess(request);
    expect(request.body).toBe(true);
    // 👇 notification for liking a post
    expect(spyCreateNotification).toHaveBeenCalledTimes(1);
    expect(spyCreateNotification).toHaveBeenCalledWith(
      NotificationType.POST_LIKE,
      expect.objectContaining<Partial<User>>({
        id: userB.id,
      }),
      post.id,
      expect.objectContaining<Partial<User>>({
        id: userA.id,
      }),
    );
  });

  it('should unlike a post', async () => {
    const query = 'unLikePost';
    let id = faker.datatype.uuid();

    await testUnauthenticated(query, { id });

    const userA = await helpers.createUser();
    const userB = await helpers.createUser();
    const post = await helpers.createPost(userA, true, {
      likes: [userB],
    });
    id = post.id;

    // 👇 get post liked by UserB
    let request = await graphQLRequest<Post>('getPost', { id });
    testSuccess(request);
    expect(request.body).toMatchObject({
      id,
      stats: {
        likes: 1,
        comments: 0,
        liked: 0,
      },
    });

    // 👇 UserB unlike the post
    const headers = await loginUser(userB);
    request = await graphQLRequest<Post>(query, { id }, headers);
    testSuccess(request);
    expect(request.body).toBe(true);

    // 👇 get post UserB stopped liking
    request = await graphQLRequest<Post>('getPost', { id });
    testSuccess(request);
    expect(request.body).toMatchObject({
      id: post.id,
      stats: {
        likes: 0,
        comments: 0,
        liked: 0,
      },
    });
  });
});
