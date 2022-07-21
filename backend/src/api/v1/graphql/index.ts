// 👇 Apollo & Graphql
import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageLocalDefault,
} from 'apollo-server-core';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/lib/use/ws';
import typeDefs from './typeDefs';
import resolvers from './resolvers';
// 👇 Node
import { Duplex } from 'node:stream';
import { existsSync, readFileSync } from 'fs';
// 👇 Express
import express from 'express';
// 👇 Cors
import cors from 'cors';
// 👇 Server
import { createServer as createServerHTTPS } from 'https';
import { createServer as createServerHTTP, IncomingMessage, Server } from 'http';
// 👇 Websocket
import { WebSocketServer } from 'ws';
// 👇 Services
import wsServer from '../services/ws';
// 👇 Middleware
import session from '../middleware/session';
// 👇 Routes
import OAuth from '../routes/OAuth';
import image from '../routes/image';
import media from '../routes/media';
// 👇 Constants, Helpers & Types
import {
  API_VERSION,
  SERVER_PORT,
  SERVER_HOST,
  PROTOCOL,
  production,
  testing,
  serverReady,
  development,
} from '../constants';
import { QueryMutationContext, SubscriptionContext } from '../types';
import { mongoConnect, postgresConnect, wsSession } from '../helpers';

const initializeApp = () => {
  const app = express();

  const whitelist = [
    // 👇 default react port
    'http://localhost:3000',
    `${PROTOCOL}://${SERVER_HOST}:${SERVER_PORT}`,
    'https://studio.apollographql.com',
  ];

  // 👇 enable this if you run behind a proxy (e.g. nginx) for example, rate limiting
  app.enable('trust proxy');

  // 👇 setup cors
  app.use(
    cors({
      credentials: true,
      origin: whitelist,
      /*
        (origin, callback) =>  {
          console.log({ origin });
          callback(null, true);
          if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
      */
    }),
  );

  // 👇 middleware that parses json request
  app.use(express.json());

  // 👇 session
  app.use(session);
  // 👇 OAuth routes
  app.use(OAuth);
  // 👇 image and media upload routes
  app.use(API_VERSION, image);
  app.use(API_VERSION, media);

  // 👇 main route only in production or testing
  if (production || testing) {
    app.get(API_VERSION, (_, res) => {
      res.send(serverReady);
    });
  }

  // 👇 server status for container health checks purposes
  app.get(API_VERSION + '/status', (_, res) => {
    res.send(serverReady);
  });

  return app;
};

const initializeWebSockets = (httpServer: Server) => {
  const emitConnection = (wss: WebSocketServer, req: IncomingMessage, socket: Duplex, head: Buffer) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  };

  // 👇 websocket server for graphql subscriptions
  const wsGraphql = new WebSocketServer({ noServer: true });

  // 👇 multiple websocket setup using different paths
  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url!, 'http://' + req.headers.host + '/');
    if (pathname === '/') {
      emitConnection(wsServer, req, socket, head);
    } else if (pathname === API_VERSION) {
      emitConnection(wsGraphql, req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return wsGraphql;
};

// 👇 get certificates for locally-trusted self-signed development
const readCerts = () => {
  const partialDir = 'certkeys/localhost.';
  const cert = partialDir + 'crt';
  const key = partialDir + 'key';
  if (existsSync(cert) && existsSync(key)) {
    return {
      cert: readFileSync(cert),
      key: readFileSync(key),
    };
  }
  return {
    cert: undefined,
    key: undefined,
  };
};

// 👇 Required logic for integrating with Express
export const startApolloServer = async () => {
  // 👇 start database servers
  await mongoConnect();

  await postgresConnect();

  const app = initializeApp();

  // 👇 create http or https server
  const httpServer = PROTOCOL === 'http' ? createServerHTTP(app) : createServerHTTPS(readCerts(), app);
  // 👇 create websocket for subscriptions
  const wsGraphql = initializeWebSockets(httpServer);

  // 👇 build schema from the provided type definitions and resolvers
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // 👇 create the subscription serer
  const serverCleanup = useServer(
    {
      schema,
      // 👇 at initializing of subscription, get the user session data and expiring time
      context: async (ctx, msg, args) => {
        const req = ctx.extra.request as unknown as express.Request;
        const user = await wsSession(req);
        const expires = user ? req.session?.cookie.expires?.getTime() : 0;
        const context: SubscriptionContext = {
          user,
          expires,
        };

        /*
          console.log('Context', {
            user,
            // req,
            session: req.session,
            expires,
          });
        */

        return context;
      },
      /*
       onConnect: async (ctx) => {
        // console.log('onConnect', {
        //   params: ctx.connectionParams,
        // });

        // Check authentication every time a client connects.
        if (ctx.connectionParams) {
          // You can return false to close the connection  or throw an explicit error
          // throw new Error('Auth token missing!');
        }
      },
      onDisconnect(ctx, code, reason) {
        console.log('Disconnected!', { ctx, code, reason });
      },
      onClose() {
        console.log('onClose!');
      },
      onNext:  () => {
        console.log('onNext!');
      },
      onOperation() {
        console.log('onOperation!');
      },
      onSubscribe() {
        console.log('onSubscribe!');
      },
      onComplete() {
        console.log('onComplete!');
      },
      onError() {
        console.log('onComplete!');
      },
      */
    },
    wsGraphql,
  );

  const apolloServer = new ApolloServer({
    schema,
    csrfPrevention: true, // Prevents CSRF mutation attack
    cache: 'bounded',
    // 👇 set exception.stacktrace error field  while developing and debugging your server
    debug: development,
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      // 👇 show playground only in development
      development
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true, includeCookies: true })
        : ApolloServerPluginLandingPageDisabled(),
      // ApolloServerPluginLandingPageGraphQLPlayground
    ],
    context: ({ req, res }): QueryMutationContext => {
      return {
        req,
        res,
        // client,
        // pubsub,
        wsServer,
      };
    },
  });
  // More required logic for integrating with Express
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    // By default, apollo-server hosts its GraphQL endpoint at the
    // server root. However, *other* Apollo Server packages host it at
    // /graphql. Optionally provide this to match apollo-server.
    path: API_VERSION,
    // cors: {
    //   origin: ['https://studio.apollographql.com', 'https://localhost:4000/v1'],
    //   credentials: true,
    // },
    cors: false,
  });

  // Modified server startup
  await new Promise<void>((resolve) => httpServer.listen({ port: SERVER_PORT }, resolve));

  console.log(serverReady);

  return { app, httpServer, apolloServer };
};
