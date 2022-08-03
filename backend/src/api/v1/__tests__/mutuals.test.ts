// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
// 👇 Constants, Helpers & Types
import { AuthInput } from '../types';
import { Follow } from './types';
import * as helpers from '../helpers';
import { ResponseCode, NotificationType } from '../types/enum';
import { graphQLRequest, loginUser, testError, useTestServer, createAuthInput, resolved } from './helpers';

// 👇 server start & stop hook
useTestServer();

describe('User Follow', () => {
  const spyCreateNotification = jest.spyOn(helpers, 'createNotification').mockImplementation(resolved);

  beforeEach(() => {
    spyCreateNotification.mockClear();
  });
  afterAll(() => {
    spyCreateNotification.mockRestore();
  });

  it('should follow and unfollow a user', async () => {
    const { user: userA, authInput } = await createAuthInput();
    const userB = await helpers.createUser();
    const headers = await loginUser(userB);

    const prevFollowCount = await graphQLRequest<Follow>('getFollowCount', { authInput });
    let request = await graphQLRequest<User>('followUser', { authInput }, headers);
    let currFollowCount = await graphQLRequest<Follow>('getFollowCount', { authInput });

    // 👇 no status
    expect(prevFollowCount.body).toEqual<Follow>({
      followers: 0,
      following: 0,
    });
    // 👇 user has a follower
    expect(currFollowCount.body).toEqual<Follow>({
      followers: 1,
      following: 0,
    });

    expect(request.body).toBe(true);
    expect(request.GQLError || request.HTTPError).toBeFalsy();
    // 👇 follow notification is published
    expect(spyCreateNotification).toHaveBeenCalledTimes(1);
    expect(spyCreateNotification).toHaveBeenCalledWith(
      NotificationType.FOLLOWING_YOU,
      expect.objectContaining<Partial<User>>({
        id: userB.id,
      }),
      `${userB.auth}/${userB.username}`,
      expect.objectContaining<Partial<User>>({
        id: userA.id,
      }),
    );

    spyCreateNotification.mockClear();
    // 👇 unfollow the user
    request = await graphQLRequest<User>('unFollowUser', { authInput }, headers);
    currFollowCount = await graphQLRequest<Follow>('getFollowCount', { authInput });
    // 👇 no status
    expect(currFollowCount.body).toEqual<Follow>({
      followers: 0,
      following: 0,
    });
    expect(request.body).toBe(true);
    expect(request.GQLError || request.HTTPError).toBeFalsy();
    expect(spyCreateNotification).toBeCalledTimes(0);
  });

  it('should follow and unfollow a user with errors', async () => {
    const userA = await helpers.createUser();

    const authInput: AuthInput = {
      auth: userA.auth,
      username: userA.username,
    };
    // 👇 unauthenticated error
    let request = await graphQLRequest<User>('followUser', { authInput });
    testError(request, ResponseCode.UNAUTHENTICATED, 'followUser');
    request = await graphQLRequest<User>('unFollowUser', { authInput });
    testError(request, ResponseCode.UNAUTHENTICATED, 'unFollowUser');
    // 👇 no notification publish since error ocurred previously
    expect(spyCreateNotification).toBeCalledTimes(0);

    // 👇 can't follow self error
    const headers = await loginUser(userA);
    request = await graphQLRequest<User>('followUser', { authInput }, headers);
    testError(request, ResponseCode.VALIDATION_ERROR, 'followUser');
    request = await graphQLRequest<User>('unFollowUser', { authInput }, headers);
    testError(request, ResponseCode.VALIDATION_ERROR, 'unFollowUser');

    // 👇 invalid user to follow error
    authInput.username = faker.helpers.unique(faker.random.alphaNumeric, [5]);
    request = await graphQLRequest<User>('followUser', { authInput }, headers);
    testError(request, ResponseCode.INPUT_ERROR, 'followUser');
    request = await graphQLRequest<User>('unFollowUser', { authInput }, headers);
    testError(request, ResponseCode.INPUT_ERROR, 'unFollowUser');

    // 👇 no notification publish since error ocurred previously
    expect(spyCreateNotification).toBeCalledTimes(0);
  });
});
