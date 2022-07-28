// 👇 Express
import express from 'express';
// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import User from '../entity/User';
// 👇 Services
import { socket } from '../services/client';
// 👇 Passport
import passportFacebook from 'passport-facebook';
// 👇 Middleware
import { verifyCallback } from '../middleware/passport';
// 👇 Constants, Helpers & Types
import * as helpers from '../helpers';
import { findUser } from '../graphql/resolvers';
import { API_VERSION, maxAge, testDate } from '../constants';
import { KeyValue, UserInput, WsAuth } from '../types';
import { AuthType, ResponseCode, Gender, ModelType, MediaCategory } from '../types/enum';
import {
  apiUrl,
  authenticateUser,
  expectImageFile,
  graphQLRequest,
  httpRequest,
  loginUser,
  mockDate,
  testCookie,
  testError,
  testSuccess,
  testUnauthenticated,
  uploadImageFile,
  useTestServer,
  wsClient,
} from './helpers';

// 👇 server start & stop hook
useTestServer();

const failAuthenticate = async (
  query: 'register' | 'login',
  input:
    | {
        userInput: Partial<UserInput>;
      }
    | KeyValue,
  status: 200 | 400 = 200,
) => {
  const prevCount = await helpers.entityManager.count(User);
  const request = await graphQLRequest<User>(query, input);
  const currCount = await helpers.entityManager.count(User);
  // 👇 check count in database before and after request
  expect(currCount).toEqual(prevCount);
  expect(request.body).toBeFalsy();
  expect(request.GQLError).toBeTruthy();
  expect(request.status).toBe(status);
  testCookie(request.headers, false);
  if (status === 400) {
    expect(request.HTTPError).toBeTruthy();
    expect(request.GQLError?.extensions.code).toBe('BAD_USER_INPUT');
  } else {
    expect(request.HTTPError).toBeFalsy();
  }
  return request;
};

const userExist = async (
  user: { id?: string; auth: AuthType; username: string },
  exist = true,
  gender = Gender.NEUTRAL,
  OAuth = false,
) => {
  const getUser = await findUser({
    auth: user.auth,
    username: user.username,
  });
  if (!exist) {
    expect(getUser).toBeFalsy();
  } else {
    if (!OAuth) {
      expect(getUser?.id).toEqual(user.id);
    }
    expect(getUser?.active).toEqual(null);
    expect(getUser?.gender).toEqual(gender);
    expect(getUser?.notification).toBeTruthy();
  }
  return getUser;
};

describe('OAuth 2.0 with Passport', () => {
  const authProvider = [AuthType.GOOGLE, AuthType.FACEBOOK];

  const testAuthResponse = (content: string, message: string, status: 'success' | 'failure') => {
    expect(content.includes(`<title>${status}</title>`)).toBe(true);
    expect(content.includes(`<p>${message}</p>`)).toBe(true);
    // expect(content.includes(`window.opener.postMessage('${status}', '*')`)).toBe(true);
  };

  it('should verify authentication callback', async () => {
    // 👇 google and facebook check
    for (const provider of authProvider) {
      let email = faker.internet.email();
      let username = email.substring(0, email.indexOf('@'));
      const profile: Partial<passportFacebook.Profile> = {
        emails: [{ value: email }],
        photos: [{ value: '' }],
        provider,
      };
      const req = {} as express.Request;
      const accessToken = '';
      const refreshToken = '';
      const done = () => {};
      // 👇 AUTHENTICATE USER WITH NO AVATAR
      await verifyCallback(req, accessToken, refreshToken, profile as passportFacebook.Profile, done);
      let user = (await userExist({ username, auth: provider }, true, Gender.NEUTRAL, true)) as User;
      const imageDb = helpers.mongoGetDb('image');
      // 👇 verify the image file should not exist
      await expectImageFile(imageDb, ModelType.AVATAR, user.id, user, false);

      const { imageId } = await uploadImageFile('AVATAR', MediaCategory.AVATAR);
      email = faker.internet.email();
      username = email.substring(0, email.indexOf('@'));
      profile.emails = [{ value: email }];
      profile.photos = [{ value: `${apiUrl()}/${API_VERSION}${`/image/${MediaCategory.AVATAR}/${imageId}`}` }];
      // 👇 AUTHENTICATE USER WITH AVATAR
      await verifyCallback(req, accessToken, refreshToken, profile as passportFacebook.Profile, done);
      user = (await userExist({ username, auth: provider }, true, Gender.NEUTRAL, true)) as User;
      // 👇 verify the image file should  exist
      await expectImageFile(imageDb, ModelType.AVATAR, user.id, user);
    }
  });

  it('should respond with success and failure redirect pages', async () => {
    // 👇 google and facebook check
    for (const strategy of authProvider) {
      // 👇 SUCCESS REDIRECT
      let request = await httpRequest('GET', `/auth/${strategy}/success`);
      testAuthResponse(request.text, 'Welcome undefined', 'success');
      expect(request.status).toBe(200);

      let user = await helpers.createUser();
      const headers = await loginUser(user);
      user = await authenticateUser(headers);
      request = await httpRequest('GET', `/auth/${strategy}/success`, headers);
      testAuthResponse(request.text, `Welcome ${user.email}`, 'success');
      expect(request.status).toBe(200);

      // 👇 FAILURE REDIRECT
      request = await httpRequest('GET', `/auth/${strategy}/failure`);
      testAuthResponse(request.text, 'Authorization failed', 'failure');
      expect(request.status).toBe(200);
    }
  });
});

describe('User Registration', () => {
  it('should register a user with errors', async () => {
    const query = 'register';

    const { username, email, password, gender, name } = await helpers.createUser(false);

    const userInput: Partial<UserInput> = {
      username,
      email,
      password,
      gender,
    };

    let request = await failAuthenticate(query, { userInput }, 400);
    userInput.name = name;
    userInput.password = faker.internet.password(3);
    request = await failAuthenticate(query, { userInput });

    testError(request, ResponseCode.INPUT_ERROR, query);

    userInput.password = password;
    await helpers.entityManager.save(User, { ...userInput, auth: AuthType.PASSWORD });
    request = await failAuthenticate(query, { userInput });

    testError(request, ResponseCode.FORBIDDEN, query);
  });

  it('should register a user successfully', async () => {
    const { username, email, password, gender, name, auth } = await helpers.createUser(false);

    const userInput: Partial<UserInput> = {
      username,
      email,
      password,
      gender,
      name,
    };

    const request = await graphQLRequest<User>('register', { userInput });
    const user = request.body as User;
    await userExist(user, true);
    expect(user.username).toEqual(username);
    expect(user.auth).toEqual(auth);

    testSuccess(request);
    testCookie(request.headers, true);
  });
});

describe('User Login & Logout', () => {
  it('should login a user with errors', async () => {
    const { email } = await helpers.createUser();
    const query = 'login';

    const userInput: KeyValue = {
      usernameOrEmail: email,
    };

    await failAuthenticate(query, userInput, 400);

    userInput.password = faker.internet.password(6);
    let request = await failAuthenticate(query, userInput);
    testError(request, ResponseCode.INPUT_ERROR, query);

    userInput.usernameOrEmail = email;
    request = await failAuthenticate('login', userInput);
    testError(request, ResponseCode.INPUT_ERROR, query);
  });

  it('should login a user successfully', async () => {
    const gender = Gender.FEMALE;
    const user = await helpers.createUser(true, {
      gender,
    });
    await loginUser(user);

    await userExist(user, true, gender);
  });

  it('should logout a user', async () => {
    const user = await helpers.createUser();
    const headers = await loginUser(user);
    const request = await graphQLRequest<User>('logout', undefined, headers);

    expect(request.body).toBe(true);
    expect(request.status).toEqual(200);
    testCookie(request.headers, false);
  });
});

describe('User Authentication Process', () => {
  it('should get user auth information', (done) => {
    const testAuth = async () => {
      const query = 'auth';

      let user = await helpers.createUser();
      await testUnauthenticated(query);
      const headers = await loginUser(user);
      user = await authenticateUser(headers);

      const wsAuth = (await socket.hgetall(user.token)) as unknown as Required<WsAuth>;
      expect(wsAuth).toMatchObject<WsAuth>({
        id: user.id,
        name: user.name,
        // 👇 redis gets number as string
        expires: expect.any(String),
        type: 'WS_AUTH_TOKEN',
      });
      const wsAuthExpire = await socket.ttl(user.token);
      expect(wsAuthExpire > 0 && wsAuthExpire <= helpers.msToSecs(maxAge)).toBeTruthy();

      return user;
    };

    testAuth().then(async (user) => {
      const spyUpdateLastSeen = jest.spyOn(helpers, 'updateLastSeen').mockImplementation(async () => {
        expect(spyUpdateLastSeen).toHaveBeenCalledTimes(1);
        expect(spyUpdateLastSeen).toHaveBeenCalledWith(user?.id);
        spyUpdateLastSeen.mockRestore();
        done();
      });
      await wsClient(user).close().expectClosed();
    });
  });

  it('should update user last seen', async () => {
    const user = await helpers.createUser();

    let getUser = await findUser({
      auth: user.auth,
      username: user.username,
    });
    expect(getUser?.id).toEqual(user.id);
    expect(getUser?.active).toEqual(null);

    await mockDate(async () => await helpers.updateLastSeen(user.id));

    getUser = await findUser({
      auth: user.auth,
      username: user.username,
    });
    expect(getUser?.id).toEqual(user.id);
    expect(getUser?.active).toStrictEqual(testDate);
  });
});
