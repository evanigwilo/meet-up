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

export const testCookie = (headers: IncomingHttpHeaders, valid: boolean) => {
  const cookies = headers['set-cookie'];
  const value = cookies && getCookieValue(cookies[0], `${SESSION_ID}=`);
  if (valid) {
    expect(value).toBeTruthy();
  } else {
    expect(value).toBeFalsy();
  }
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
