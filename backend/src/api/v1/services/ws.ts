// 👇 WebSocket
import WebSocket, { WebSocketServer } from 'ws';
// 👇 Entities
import User from '../entity/User';
import Message from '../entity/Message';
import Conversation from '../entity/Conversation';
// 👇 Generators & Validators
import { randomUUID } from 'crypto';
// 👇 Redis
import { socket } from './client';
// 👇 Constants, Helpers & Types
import { KeyValue, WsAuth } from '../types';
import { PROTOCOL, expire5mins, serverName, missedVideoCall } from '../constants';
import { entityManager, constructMessage, deconstructMessage, updateLastSeen, sleep } from '../helpers';
import { ResponseCode, UploadType } from '../types/enum';

// 👇 websocket server
const wsServer = new WebSocketServer({ noServer: true });

wsServer.on('connection', async (ws, req) => {
  const { searchParams } = new URL(req.url!, PROTOCOL + '://' + req.headers.host + '/');
  const token = searchParams.get('token') || '';

  const value = (await socket.hgetall(token)) as unknown as Required<WsAuth>;
  // 👇 cast to number as redis gets number as string
  value.expires = Number(value.expires);

  // 👇 close socket if token is auth invalid
  if (value.type !== 'WS_AUTH_TOKEN') {
    ws.close(1000, ResponseCode.UNAUTHENTICATED);
    return;
  }

  // 👇 store session
  ws.session = value;

  // 👇 user id as socket id
  const wsId = value.id;

  /*
    const wsKey = req.headers['sec-websocket-key']
  */

  // 👇 send connected message to client
  ws.send(
    constructMessage({
      type: 'CONNECTION',
      content: wsId,
      from: serverName,
    }),
  );

  ws.on('message', async (rawData) => {
    const { type, content, to } = deconstructMessage(rawData.toString());

    switch (type) {
      case 'MESSAGE':
      case UploadType.MESSAGE_IMAGE:
      case UploadType.MESSAGE_MEDIA:
      case UploadType.POST_IMAGE:
      case UploadType.POST_MEDIA:
      case UploadType.REPLY_IMAGE:
      case UploadType.REPLY_MEDIA:
        // 👇 send unique id to client
        try {
          const id = randomUUID();
          await socket.setex(id, expire5mins, type);
          (content as KeyValue).id = id;
          ws.send(
            constructMessage({
              type,
              content,
              from: wsId,
            }),
          );
        } catch {}
        break;

      /*

      case 'BROADCAST':
        // 👇 send message to all clients except self
        wsServer.clients.forEach((client) => {
          if (client.session.id !== wsId && client.readyState === WebSocket.OPEN) {
            client.send(
              constructMessage({
                type,
                content,
                from: wsId,
              }),
            );
          }
        });
        break;

      case 'DIRECT':
        // 👇 send message to a specific client
        wsServer.clients.forEach((client) => {
          if (client.session.id === to && client.readyState === WebSocket.OPEN) {
            client.send(
              constructMessage({
                type,
                content,
                from: wsId,
              }),
            );
          }
        });
        break;

      */

      case 'USER_BUSY':
      case 'CALL_CANCELED':
      case 'ANSWER_OFFER':
        for (const client of wsServer.clients) {
          // 👇 first online client only
          if (
            client.session.id !== wsId &&
            client.readyState === WebSocket.OPEN &&
            Boolean(client.session.link) &&
            client.session.link === ws.session.link &&
            Date.now() < client.session.expires
          ) {
            // 👇 cancel link between the clients
            client.session.link = ws.session.link = '';

            client.send(
              constructMessage({
                type,
                content,
                from: wsId,
              }),
            );

            return;
          }
        }
        break;

      case 'CALL_OFFER':
        // 👇 is user offline
        if (Date.now() > ws.session.expires) {
          ws.send(
            constructMessage({
              type: ResponseCode.UNAUTHENTICATED,
              from: serverName,
            }),
          );

          return;
        }
        for (const client of wsServer.clients) {
          // 👇 first online client only
          if (client.session.id === to && client.readyState === WebSocket.OPEN && Date.now() < client.session.expires) {
            // 👇 generate id to link the to clients
            const linkId = randomUUID();
            client.session.link = ws.session.link = linkId;

            client.send(
              constructMessage({
                type,
                content: {
                  signal: content,
                  name: ws.session.name,
                },
                to,
                from: wsId,
              }),
            );

            // 👇
            // no answer after 1 minute
            // link should have been cleared if call was answered
            sleep(60)
              .then(async () => {
                if (client.session.link === linkId && ws.session.link === linkId) {
                  // 👇 cancel link between the clients
                  client.session.link = ws.session.link = '';

                  // 👇 create missed video call message
                  new Message({
                    id: linkId,
                    from: { id: wsId },
                    to: { id: to },
                    body: missedVideoCall,
                    missed: true,
                  })
                    .save()
                    .finally(() => {
                      // 👇 send no answer to caller
                      ws.send(
                        constructMessage({
                          type: 'NO_ANSWER',
                          from: serverName,
                        }),
                      );
                    });
                }
              })
              .catch(() => {});

            return;
          }
        }

        // 👇 user offline
        ws.send(
          constructMessage({
            type: 'USER_OFFLINE',
            // content,
            from: serverName,
          }),
        );

        break;

      case 'ONLINE':
        let online = '';
        /*
        NONE | ONLINE | TYPING | else time
        */
        for (const client of wsServer.clients) {
          // 👇 first online client only
          if (client.session.id === to && client.readyState === WebSocket.OPEN && Date.now() < client.session.expires) {
            online = 'ONLINE';
            break;
          }
        }

        if (online) {
          // 👇 is the online user typing
          const typing = await socket.get(`${to}:TYPING`);
          if (typing) {
            online = 'TYPING';
          }
        } else {
          // 👇 try get last seen from cache first before database
          const lastSeen = await socket.get(`${to}:LAST_SEEN`);
          if (lastSeen) {
            online = lastSeen;
          } else {
            try {
              online = 'NONE';
              const user = await entityManager.findOne(User, {
                where: { id: to },
                select: { active: true },
              });
              if (user?.active) {
                online = user.active.getTime().toString();
              }
            } catch (error) {
              // console.log('\nError Getting active', { error });
            } finally {
              // 👇 set last seen in cache
              await socket.setex(`${to}:LAST_SEEN`, expire5mins, online);
            }
          }
        }

        // 👇 send last seen time status to client
        ws.send(
          constructMessage({
            type,
            content: {
              id: to,
              online,
            },
            from: serverName,
          }),
        );
        break;

      case 'TYPING':
        // 👇 is user session still valid
        if (Date.now() < ws.session.expires) {
          // 👇 after 3 secs clear typing from cache
          await socket.setex(`${wsId}:TYPING`, 3, 1);
        }
        break;

      case 'SEEN_CONVERSATION':
        // 👇 is user session still valid
        if (Date.now() < ws.session.expires) {
          const to = content as string;

          await entityManager.update(
            Conversation,
            { from: to, to: wsId },
            {
              seen: true,
              // 👇 for conversation subscriber to use in subscription
              from: { id: to },
              to: { id: wsId },
            },
          );
        }
        break;

      default:
        break;
    }
  });

  ws.onclose = () => {
    for (const client of wsServer.clients) {
      if (client.session.id === wsId && client.readyState === WebSocket.OPEN) {
        return;
      }
    }
    // 👇 update last seen if all instance of client is closed
    updateLastSeen(wsId);
  };
});

export default wsServer;
