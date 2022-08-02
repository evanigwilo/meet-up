// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
import Post from '../entity/Post';
// 👇 Constants, Helpers & Types
import { Follow } from './types';
import { ResponseCode } from '../types/enum';
import { maxLimit, maxUsers } from '../constants';
import {
  useTestServer,
  graphQLRequest,
  loginUser,
  testSuccess,
  testError,
  testPagination,
  testUnauthenticated,
  testUserNotFound,
  createAuthInput,
  updateAuthInput,
} from './helpers';
import { createUser, createPost, bulkUserPosts, bulkUserFollowers, bulkUserFollowing, bulkUsers } from '../helpers';

// 👇 server start & stop hook
useTestServer();

describe('User Profile', () => {
  it('should update user bio', async () => {
    const query = 'updateBio';
    const variables = { bio: faker.random.words(3) };

    await testUnauthenticated(query, variables);

    const user = await createUser();
    const headers = await loginUser(user);
    let request = await graphQLRequest<User>(query, variables, headers);
    testSuccess(request);
    expect(request.body).toBe(true);

    request = await graphQLRequest<User>('auth', undefined, headers);
    testSuccess(request);
    expect(request.body?.bio).toEqual(variables.bio);
  });

  it('should update user notification switch', async () => {
    const query = 'toggleNotification';
    const variables = { toggle: false };

    await testUnauthenticated(query, variables);

    const user = await createUser();
    const headers = await loginUser(user);
    let request = await graphQLRequest<User>(query, variables, headers);
    testSuccess(request, false);
    expect(request.body).toEqual(variables.toggle);
    // 👇 confirm notification toggle is updated
    request = await graphQLRequest<User>('auth', undefined, headers);
    testSuccess(request);
    expect(request.body?.notification).toEqual(variables.toggle);
  });

  it('should get a user', async () => {
    const { user, authInput } = await createAuthInput();

    const request = await graphQLRequest<User>('getUser', { authInput });
    testSuccess(request);
    expect(request.body?.id).toEqual(user.id);
  });

  it('should get a user not found', async () => {
    await testUserNotFound('getUser');
  });

  it('should get a user follower count', async () => {
    const query = 'getFollowCount';

    await testUserNotFound(query);

    const { authInput } = await createAuthInput();

    const request = await graphQLRequest<Follow>(query, { authInput });
    const body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(0);
    expect(body?.followers).toEqual(0);
  });

  it('should get a user follow status', async () => {
    const query = 'getFollowStatus';

    const input = await createAuthInput(false);
    await testUnauthenticated(query, { authInput: input.authInput });

    const { user: userA, authInput } = await createAuthInput();
    const userB = await createUser();
    let headers = await loginUser(userA);
    await testUserNotFound(query, headers);

    let request = await graphQLRequest<Follow>(query, { authInput }, headers);
    testError(request, ResponseCode.VALIDATION_ERROR, query);

    // 👇 no status
    updateAuthInput(authInput, userB);
    request = await graphQLRequest<Follow>(query, { authInput }, headers);
    let body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(0);
    expect(body?.followers).toEqual(0);

    // 👇 UserA follows UserB
    await graphQLRequest<User>('followUser', { authInput }, headers);
    request = await graphQLRequest<Follow>(query, { authInput }, headers);
    body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(1);
    expect(body?.followers).toEqual(0);

    // 👇 UserB follows UserA
    headers = await loginUser(userB);
    updateAuthInput(authInput, userA);
    request = await graphQLRequest<Follow>(query, { authInput }, headers);
    body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(0);
    expect(body?.followers).toEqual(1);

    // 👇 login with UserB, UserA and UserB are mutual
    await graphQLRequest<User>('followUser', { authInput }, headers);
    request = await graphQLRequest<Follow>(query, { authInput }, headers);
    body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(1);
    expect(body?.followers).toEqual(1);

    // 👇 login with UserA, UserA and UserB are mutual
    headers = await loginUser(userA);
    updateAuthInput(authInput, userB);
    request = await graphQLRequest<Follow>(query, { authInput }, headers);
    body = request.body;
    testSuccess(request);
    expect(body?.following).toEqual(1);
    expect(body?.followers).toEqual(1);
  });

  it('should get users the user is following', async () => {
    const query = 'getFollowing';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();
    // 👇 user is not following any body
    let request = await graphQLRequest<User[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);
    // 👇 make user follow bulk users
    let following = await bulkUserFollowing(user, maxLimit);
    request = await graphQLRequest<User[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    // 👇 check if user is following the bulk users
    expect(body).toHaveLength(maxLimit);
    body?.forEach((user, index) => expect(user.id).toEqual(following[index].id));
    // 👇 check pagination
    user = await updateAuthInput(authInput);
    following = await bulkUserFollowing(user, maxLimit * 2);
    await testPagination(query, following, { authInput });
  });

  it('should get user followers', async () => {
    const query = 'getFollowers';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();

    // 👇 user has no  followers
    let request = await graphQLRequest<User[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    // 👇 make user have bulk followers
    let followers = await bulkUserFollowers(user, maxLimit);
    request = await graphQLRequest<User[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    // 👇 check if user has the bulk followers
    expect(body).toHaveLength(maxLimit);
    body?.forEach((user, index) => expect(user.id).toEqual(followers[index].id));

    // 👇 check pagination
    user = await updateAuthInput(authInput);
    followers = await bulkUserFollowers(user, maxLimit * 2);
    await testPagination(query, followers, { authInput });
  });

  it('should get user posts with no media', async () => {
    const query = 'getUserPosts';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();

    let request = await graphQLRequest<Post[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    let posts = await bulkUserPosts(user, maxLimit);
    request = await graphQLRequest<Post[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((post, index) => {
      expect(post.createdBy.id).toEqual(posts[index].createdBy.id);
      expect(post.parent).toBeFalsy();
      expect(post.media).toBeFalsy();
    });

    user = await updateAuthInput(authInput);
    posts = await bulkUserPosts(user, maxLimit * 2);
    await testPagination(query, posts, { authInput });
  });

  it('should get user posts with media', async () => {
    const query = 'getUserMedias';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();

    let request = await graphQLRequest<Post[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    const media = 'image/jpeg';
    let posts = await bulkUserPosts(user, maxLimit, {
      media,
    });
    request = await graphQLRequest<Post[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((post, index) => {
      expect(post.createdBy.id).toEqual(posts[index].createdBy.id);
      expect(post.parent).toBeFalsy();
      expect(post.media).toEqual(media);
    });

    user = await updateAuthInput(authInput);
    posts = await bulkUserPosts(user, maxLimit * 2, {
      media,
    });
    await testPagination(query, posts, { authInput });
  });

  it('should get user comments', async () => {
    const query = 'getUserComments';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();

    let request = await graphQLRequest<Post[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    const parent = await createPost(user);
    let comments = await bulkUserPosts(user, maxLimit, {
      parent,
    });
    request = await graphQLRequest<Post[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((comment, index) => {
      expect(comment.createdBy.id).toEqual(comments[index].createdBy.id);
      expect(comment.parent?.id).toEqual(parent.id);
    });

    user = await updateAuthInput(authInput);
    comments = await bulkUserPosts(user, maxLimit * 2, {
      parent,
    });
    await testPagination(query, comments, { authInput });
  });

  it('should get posts and comments the user liked', async () => {
    const query = 'getUserLikes';

    await testUserNotFound(query);

    let { user, authInput } = await createAuthInput();

    let request = await graphQLRequest<Post[]>(query, { authInput });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    const postCreator = await createUser();
    let posts = await bulkUserPosts(postCreator, maxLimit, {
      likes: [user],
    });
    request = await graphQLRequest<Post[]>(query, { authInput });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((post, index) => {
      expect(post.createdBy.id).toEqual(posts[index].createdBy.id);
      expect(post.stats).toEqual({
        likes: 1,
        comments: 0,
        liked: 0,
      });
    });

    // 👇 login with user and check like status
    const headers = await loginUser(user);
    request = await graphQLRequest<Post[]>(query, { authInput }, headers);
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxLimit);
    body?.forEach((post, index) => {
      expect(post.createdBy.id).toEqual(posts[index].createdBy.id);
      expect(post.stats).toEqual({
        likes: 1,
        comments: 0,
        liked: 1,
      });
    });

    user = await updateAuthInput(authInput);
    posts = await bulkUserPosts(user, maxLimit * 2, {
      likes: [user],
    });
    await testPagination(query, posts, { authInput });
  });

  it('should find a user', async () => {
    const query = 'findUser';

    // 👇 handle not existing
    let user = await createUser(false);
    let handle = user.username;
    let request = await graphQLRequest<User[]>(query, { handle });
    let body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(0);

    // 👇 handle existing
    user = await createUser();
    handle = user.username;
    request = await graphQLRequest<User[]>(query, { handle });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(1);
    expect(body?.[0].id).toEqual(user.id);

    // 👇 creat bulk users and find all the users
    handle = faker.name.fullName();
    const users = await bulkUsers(maxUsers, handle);
    request = await graphQLRequest<User[]>(query, { handle });
    body = request.body;
    testSuccess(request);
    expect(body).toHaveLength(maxUsers);
    body?.forEach((user, index) => {
      expect(user.id).toEqual(users[index].id);
      expect(user.name).toEqual(handle);
    });
  });
});
