// 👇 Node
import path from 'path';
import { EventEmitter } from 'events';
// 👇 Faker
// 👇 Server
import { IncomingHttpHeaders } from 'http';
// 👇 Supertest
import supertest from 'supertest';
import superwstest from 'superwstest';
import { SuperTestExecutionStreamingResult, supertestWs } from 'supertest-graphql';
// 👇 Entities
import User from '../../entity/User';
import Message from '../../entity/Message';
// 👇 Services
import pubsub from '../../services/pubsub';
// 👇 Middleware
import * as auth from '../../middleware/auth';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Constants, Helpers & Types
import * as helpers from '../../helpers';
import { startApolloServer } from '../../graphql';
import { entityManager } from '../../helpers';
import { TEST_STATUS } from '../types/enum';
import { AuthInput, ImageSchema, KeyValue, SocketMessage } from '../../types';
import { ResponseCode, Publish, MediaCategory, ModelType, UploadType } from '../../types/enum';
import { GqlError, GqlMutations, GqlQueries, GraphQLRequest, HttpRequest, Variables } from '../types';
import {
  PROTOCOL,
  SERVER_HOST,
  SERVER_PORT,
  API_VERSION,
  serverName,
  maxLimit,
  realDate,
  testDate,
  SESSION_ID,
} from '../../constants';
import { gqlMimeTypes, gqlMutations, gqlQueries, gqlSubscriptions, gqlUser, gqlUserSub } from '../constants';

// 👇 set max listeners to prevent memory leak warnings
EventEmitter.defaultMaxListeners = 50;

export const resolved = () => Promise.resolve();
export const rejected = () => Promise.reject();

export const apiUrl = (ws = false) =>
  `${ws ? (PROTOCOL === 'http' ? 'ws' : 'wss') : PROTOCOL}://${SERVER_HOST}:${SERVER_PORT}`;

const apiRequest = supertest(
  /* 
    server?.app
  */
  apiUrl(),
);

const wsSocket = superwstest(
  // @ts-ignore: Object is possibly 'null'.
  /* 
    server?.httpServer // dons't connect from container.
  */
  apiUrl(),
);

const wsGql = supertestWs(
  /* 
    server?.httpServer // dons't connect from container.
  */
  apiUrl(true),
).path(API_VERSION);

export const useTestServer = (args?: Partial<{ beforeAll: () => void; afterAll: () => void }>) => {
  let server: Awaited<ReturnType<typeof startApolloServer>> | null = null;

  // 👇 before the tests we will spin up a new Apollo Server
  beforeAll(async () => {
    console.log(TEST_STATUS.START_SERVER);
    // 👇 server depends on redis, mongo and postgres services
    server = await startApolloServer();
    args?.beforeAll?.();
  });

  afterAll(async () => {
    console.log(TEST_STATUS.STOP_SERVER);
    // 👇 after the tests we will stop our server
    if (server) {
      const { apolloServer, httpServer } = server;
      await apolloServer.stop();
      // 👇 wait for httpServer to close
      await new Promise<void>((resolve) => {
        httpServer.close((error) => {
          resolve();
        });
      });
      // 👇 close all mongoose connections
      for (const connection of mongoose.connections) {
        await connection.close();
      }
      // await (await wsGql).close();
    }
    args?.afterAll?.();
  });

  return () => server;
};

export const graphQLRequest = async <T>(
  query: GqlQueries | GqlMutations,
  variables?: Variables,
  headers?: IncomingHttpHeaders,
) => {
  const request = apiRequest.post(API_VERSION);
  const cookie = headers?.['set-cookie'];
  if (cookie) {
    // 👇 set cookie header
    request.set('Cookie', cookie);
  }

  const response = await request.send({
    query: query in gqlQueries ? gqlQuery(query as GqlQueries) : gqlMutations[query as GqlMutations],
    variables,
  });

  return {
    body: response.body?.data?.[query] as T | undefined,
    headers: response.headers as IncomingHttpHeaders,
    GQLError: response.body?.errors?.[0] as GqlError | undefined,
    status: response.statusCode,
    HTTPError: response.error,
  };
};

export const graphQLSocket = async <T>(args: {
  subscription: Publish;
  next: (value: T) => void;
  callback: (user: User, iterator: SuperTestExecutionStreamingResult<any>) => void;
}) => {
  const { subscription, next, callback } = args;
  // 👇 mock authenticated user with active session
  const user = await helpers.createUser();
  const spyDate = jest.spyOn(global.Date, 'now').mockReturnValue(0);
  const spyAuth = jest.spyOn(auth, 'auth').mockReturnValue(user);

  const iterator = await wsGql.subscribe(gqlSubscriptions[subscription]);

  pubsub
    .asyncIterator(subscription)
    .next()
    .then(({ value }) => {
      next((value as KeyValue)[subscription] as unknown as T);
      // iterator.close().then(() => {});
    })
    .then(() => {
      // 👇 restore mocked methods
      spyDate.mockRestore();
      spyAuth.mockRestore();
    });

  /*
    iterator
      .next()
      .then(({ data, errors, extensions }) => {
        // console.log({ data, errors, extensions });
        next((data as KeyValue)[subscription] as unknown as T);
      })
      .then(() => {
        // 👇 restore mocked methods
        spyDate.mockRestore();
        spyAuth.mockRestore();
      }); 
  */

  callback(user, iterator);
};

export const httpRequest = async <T>(
  method: 'GET' | 'POST' | 'DELETE',
  route: string,
  headers?: IncomingHttpHeaders,
  upload?: 'image' | 'video' | 'audio',
  attach?: 'image' | 'video' | 'audio',
) => {
  const url = API_VERSION + route;
  const request =
    method === 'GET' ? apiRequest.get(url) : method === 'POST' ? apiRequest.post(url) : apiRequest.delete(url);
  const cookie = headers?.['set-cookie'];
  if (cookie) {
    // 👇 set cookie header
    request.set('Cookie', cookie);
  }

  if (upload) {
    const location = attach
      ? attach === 'image'
        ? '../../images'
        : '../../media'
      : upload === 'image'
      ? '../../images'
      : '../../media';

    const file = attach
      ? attach === 'image'
        ? 'avatar.png'
        : attach === 'video'
        ? 'video.webm'
        : 'audio.mp3'
      : upload === 'image'
      ? 'avatar.png'
      : upload === 'video'
      ? 'video.webm'
      : 'audio.mp3';

    request.set('Content-Type', 'multipart/form-data');
    request.attach(upload === 'image' ? 'image' : 'media', path.join(__dirname, location, file));
  }

  const response = await request;
  return {
    body: response.body as T | undefined,
    text: response.text,
    headers: response.headers as IncomingHttpHeaders,
    status: response.statusCode,
    HTTPError: response.error,
  };
};

export const wsClient = (user: Partial<User>) => {
  const ws = wsSocket.ws(`/?token=${user?.token}`).expectJson({
    type: 'CONNECTION',
    content: user?.id || '',
    from: serverName,
  });

  return ws;
};

export const wsSend = async <T>(user: User, message: SocketMessage, match: {} | any[]) => {
  let value: T | null = null;

  await wsClient(user)
    .sendText(helpers.constructMessage(message))
    .expectText((data) => {
      const deconstruct = helpers.deconstructMessage(data);
      expect(deconstruct).toMatchObject(match);
      value = deconstruct.content as T;
    })
    .close()
    .expectClosed();

  return value as unknown as T;
};

export const wsToken = async (user: User, type: 'MESSAGE' | UploadType) => {
  const { id } = await wsSend<KeyValue>(
    user,
    {
      type,
      to: serverName,
      content: {},
    },
    {
      type,
      from: user.id,
      content: {
        id: expect.any(String),
      },
    },
  );
  return id;
};

export const getCookieValue = (cookie: string, key: 'Path=' | 'Expires=' | 'HttpOnly' | string) => {
  /*
    'sid=s%3A0CbvZxykCzSRSWzxnDO1YFvH-cm3cNLl.XjmxhNdWl62CvQRiGV67vCcolPGoi3A867xLKUyHrV0; Path=/v1; Expires=Wed, 08 Feb 2022 00:50:58 GMT; HttpOnly'
    'sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  */
  if (key === 'HttpOnly') {
    return cookie.includes('HttpOnly'); // case-sensitive
  }
  const index = cookie.indexOf(key);
  const value = cookie.substring(index, cookie.indexOf(';', index)).slice(key.length);
  // new Date(expire).getTime()
  return value;
};

export const testError = (
  request: GraphQLRequest,
  code: ResponseCode,
  query: GqlQueries | GqlMutations | string[],
  cookie = false,
) => {
  expect(request.body).toBeFalsy();
  expect(request.GQLError?.message).toBe(code);
  if (query instanceof Array) {
    query.forEach((item) => {
      expect(request.GQLError?.extensions).toHaveProperty(item);
    });
  } else {
    expect(request.GQLError?.extensions).toHaveProperty(query);
  }
  expect(request.status).toBe(200);
  testCookie(request.headers, cookie);
};

export const testSuccess = (request: GraphQLRequest, body = true) => {
  expect(request.GQLError || request.HTTPError).toBeFalsy();
  expect(request.status).toBe(200);
  if (body) {
    expect(request.body).toBeTruthy();
  }
};

export const testUnauthenticated = async (query: GqlQueries | GqlMutations, variables?: Variables) => {
  const requestError = await graphQLRequest<User>(query, variables);
  testError(requestError, ResponseCode.UNAUTHENTICATED, query);
};

export const testPagination = async <T extends { id?: string; message?: Message }>(
  query: GqlQueries | GqlMutations,
  value: T[],
  variables: Variables,
  headers?: IncomingHttpHeaders,
) => {
  let request = await graphQLRequest<T[]>(query, variables, headers);
  let body = request.body;
  // 👇 messages and conversations response comes in reverse order (newer at bottom)
  const reverse = query === 'getConversations' || query === 'getMessages';
  const index = reverse ? value.length - 1 : 0;
  const limit = reverse ? maxLimit - 1 : maxLimit;

  testSuccess(request);
  expect(body).toHaveLength(maxLimit);
  expect(query === 'getConversations' ? body?.[0].message?.id : body?.[0].id).toEqual(value[index].id);

  variables.offset = maxLimit;
  request = await graphQLRequest<T[]>(query, variables, headers);
  body = request.body;
  testSuccess(request);
  expect(body).toHaveLength(maxLimit);
  expect(query === 'getConversations' ? body?.[0].message?.id : body?.[0].id).toEqual(value[limit].id);

  variables.offset = maxLimit * 2;
  request = await graphQLRequest<T[]>(query, variables, headers);
  body = request.body;
  testSuccess(request);
  expect(body).toHaveLength(0);

  variables.offset = 0;
  variables.limit = Math.floor(maxLimit / 2);
  request = await graphQLRequest<T[]>(query, variables, headers);
  body = request.body;
  testSuccess(request);
  expect(body).toHaveLength(variables.limit);
  expect(query === 'getConversations' ? body?.[0].message?.id : body?.[0].id).toEqual(value[index].id);
};

export const testCookie = (headers: IncomingHttpHeaders, valid: boolean) => {
  const cookies = headers['set-cookie'];
  const value = cookies && getCookieValue(cookies[0], `${SESSION_ID}=`);
  if (valid) {
    expect(value).toBeTruthy();
  } else {
    expect(value).toBeFalsy();
  }
};

export const testUserNotFound = async (query: GqlQueries | GqlMutations, headers?: IncomingHttpHeaders) => {
  const user = await helpers.createUser(false);
  const authInput: AuthInput = {
    auth: user.auth,
    username: user.username,
  };
  const requestError = await graphQLRequest<User>(query, { authInput }, headers);
  testError(requestError, ResponseCode.INPUT_ERROR, query);
};

export const isMimeType = (type: 'image' | 'video' | 'audio', value?: string) => {
  if (!value) {
    return false;
  }
  switch (type) {
    case 'image':
      return /^image/i.test(value);

    case 'video':
      return /^video/i.test(value);

    case 'audio':
      return /^audio/i.test(value);
    default:
      return false;
  }
};

export const mockDate = async (callback: () => Promise<void>) => {
  const date = jest.fn<Date, any[]>().mockReturnValue(testDate);
  (global.Date as unknown as typeof date) = date;
  await callback();
  global.Date = realDate;
};

export const mockSleep = (implementation: 'RESOLVED' | 'REJECTED') =>
  jest
    .spyOn(helpers, 'sleep')
    .mockClear()
    .mockImplementation(implementation === 'RESOLVED' ? resolved : rejected);

export const conversationUsers = async () => {
  let from = await helpers.createUser();
  let to = await helpers.createUser();
  from = await authenticateUser(await loginUser(from));
  to = await authenticateUser(await loginUser(to));
  return {
    from,
    to,
  };
};

export const loginUser = async (user: User) => {
  const prevCount = await entityManager.count(User);
  const request = await graphQLRequest<User>('login', {
    usernameOrEmail: user.email,
    password: user.password,
  });
  const currCount = await entityManager.count(User);
  expect(currCount).toBe(prevCount);
  expect(request.body).toBeTruthy();
  expect(request.GQLError || request.HTTPError).toBeFalsy();
  expect(request.status).toBe(200);
  testCookie(request.headers, true);

  return request.headers;
};

export const authenticateUser = async (headers: IncomingHttpHeaders, user?: User) => {
  const request = await graphQLRequest<User>('auth', undefined, headers);
  const body = request.body as User;
  expect(body.token).toBeTruthy();
  testSuccess(request);
  testCookie(request.headers, true);
  if (!user) {
    expect(body.notifications).toEqual([{ type: 'CONVERSATIONS', total: 0 }]);
  }
  return body;
};

export const expectImageFile = async (
  imageDb: mongoose.Connection | undefined,
  collection: ModelType,
  filename: string,
  user: User,
  exist = true,
) => {
  const imageFile = await helpers.getImageFile(imageDb, collection, {
    filename,
    'metadata.userId': user.id,
  });
  if (exist) {
    expect(imageFile).toMatchObject<Partial<ImageSchema>>({
      _id: expect.any(mongoose.Types.ObjectId),
      filename,
      metadata: expect.objectContaining<Partial<ImageSchema['metadata']>>({
        userId: user.id,
        username: user.username,
        auth: user.auth,
      }),
    });
  } else {
    expect(imageFile).toBe(null);
  }

  return imageFile;
};

export const expectImageSuccess = (request: HttpRequest, buffer = false) => {
  if (buffer) {
    expect(Buffer.isBuffer(request.body)).toBe(true);
    expect(isMimeType('image', request.headers['content-type'])).toBe(true);
  } else {
    expect(request.body).toMatchObject({ code: ResponseCode.SUCCESS });
  }
  expect(request.status).toEqual(200);
};

export const expectMediaSuccess = (request: HttpRequest, media: 'video' | 'audio', streaming = false) => {
  if (streaming) {
    expect(Buffer.isBuffer(request.body)).toBe(true);
    expect(isMimeType(media, request.headers['content-type'])).toBe(true);
    expect(request.headers['content-range']).toMatch(/^bytes 0-/i);
    // 👇 partial content
    expect(request.status).toEqual(206);
  } else {
    expect(request.body).toMatchObject({
      id: expect.any(String),
      file: expect.objectContaining({
        filename: expect.any(String),
        contentType: expect.stringContaining(media),
        size: expect.any(Number),
      }),
    });
    expect(request.status).toEqual(200);
  }
};

export const uploadImageFile = async (
  type:
    | 'MESSAGE'
    | Extract<UploadType, UploadType.MESSAGE_IMAGE | UploadType.POST_IMAGE | UploadType.REPLY_IMAGE>
    | 'AVATAR',
  category: MediaCategory,
) => {
  let user = await helpers.createUser();
  const headers = await loginUser(user);
  user = await authenticateUser(headers);
  const avatarType = type === 'AVATAR';
  const imageId = avatarType ? user.id : await wsToken(user, type);
  const route = avatarType ? `/image/${category}` : `/image/${category}/${imageId}`;

  // 👇 Upload image
  const request = await httpRequest('POST', route, headers, 'image');
  expectImageSuccess(request);

  return {
    user,
    headers,
    imageId,
  };
};

export const uploadMediaFile = async (
  type: Extract<UploadType, UploadType.MESSAGE_MEDIA | UploadType.POST_MEDIA | UploadType.REPLY_MEDIA>,
  category: Exclude<MediaCategory, MediaCategory.AVATAR>,
  media: 'video' | 'audio',
) => {
  let user = await helpers.createUser();
  const headers = await loginUser(user);
  user = await authenticateUser(headers);
  const mediaId = await wsToken(user, type);
  const route = `/media/${category}/${mediaId}`;

  // 👇 Upload media
  const request = await httpRequest('POST', route, headers, media);
  expectMediaSuccess(request, media);

  return {
    user,
    headers,
    mediaId,
  };
};

export const createAuthInput = async (save = true) => {
  const user = await helpers.createUser(save);
  const authInput: AuthInput = {
    auth: user.auth,
    username: user.username,
  };
  return { user, authInput };
};

export const updateAuthInput = async (authInput: AuthInput, user?: User) => {
  user = user || (await helpers.createUser());
  authInput.auth = user.auth;
  authInput.username = user.username;
  return user;
};

// 👇 queries helper
export const gqlQuery = (query: GqlQueries) => {
  switch (query) {
    case 'auth':
      return `
        query auth {
          auth {
            ${gqlUser}
          }
        }
      `;
    case 'getMimeTypes':
      return `
          query getMimeTypes {
            getMimeTypes {
              ${gqlMimeTypes}
            }
          }
        `;

    case 'findUser':
      return `
        query findUser($handle: String!) {
          findUser(handle: $handle) {
            ${gqlUserSub}
          }
        }
        `;

    case 'getConversations':
    case 'getNotifications':
      return queryAuthPaginate({
        query,
        id: false,
        auth: false,
        paginate: true,
      });

    case 'getPosts':
    case 'getMessages':
      return queryAuthPaginate({
        query,
        id: true,
        auth: false,
        paginate: true,
      });

    case 'getPost':
      return queryAuthPaginate({
        query,
        id: 'REQUIRED',
        auth: false,
        paginate: false,
      });

    case 'getFollowing':
    case 'getUserLikes':
    case 'getFollowers':
    case 'getUserPosts':
    case 'getUserComments':
    case 'getUserMedias':
      return queryAuthPaginate({
        query,
        id: false,
        auth: true,
        paginate: true,
      });

    case 'getUser':
    case 'getFollowCount':
    case 'getFollowStatus':
      return queryAuthPaginate({
        query,
        id: false,
        auth: true,
        paginate: false,
      });

    default:
      return ``;
  }
};

// 👇 query generator function
export const queryAuthPaginate = ({
  query,
  id,
  auth,
  paginate,
}: {
  query: GqlQueries;
  id?: boolean | 'REQUIRED';
  auth?: boolean;
  paginate?: boolean;
}) => `
query ${query}(${!id ? '' : id === 'REQUIRED' ? '$id: ID!,' : '$id: ID,'}${auth ? '$authInput: AuthInput!,' : ''}${
  paginate ? '$limit: Int, $offset: Int' : ''
}) {
  ${query}(${id ? 'id: $id,' : ''}${auth ? 'authInput: $authInput,' : ''}${
  paginate ? 'limit: $limit, offset: $offset' : ''
}) {
    ${gqlQueries[query]}
  }
}
`;
