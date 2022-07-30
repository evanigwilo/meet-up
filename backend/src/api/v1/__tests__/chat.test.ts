// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Entities
import User from '../entity/User';
// 👇 Constants, Helpers & Types
import * as helpers from '../helpers';
import { useTestServer, resolved, wsClient, mockDate, conversationUsers } from './helpers';
import { Conversations, SocketMessage } from '../types';
import { Publish } from '../types/enum';
import { serverName, testDate } from '../constants';
import { deconstructMessage } from '../helpers';

// 👇 server start & stop hook
useTestServer();

describe('Chat Events', () => {
  // 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
  const spyPublish = jest.spyOn(pubsub, 'publish').mockImplementation(resolved);
  // 👇 MOCKING UPDATING LAST SEEN ON SOCKET CLOSE
  let spyUpdateLastSeen = jest.spyOn(helpers, 'updateLastSeen');

  afterAll(() => {
    spyPublish.mockRestore();
  });

  it('should get user online status - online', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);

      // 👇 MOCK LAST SEEN WHEN SOCKETS CLOSE
      spyUpdateLastSeen.mockImplementation(async (id) => {
        if (id === from.id) {
          toSocket.close();
        } else if (id === to.id) {
          done();
        }
      });

      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'ONLINE',
            to: to.id,
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: 'ONLINE',
            content: {
              id: to.id,
              online: 'ONLINE',
            },
            from: serverName,
          });
        })
        .close()
        .expectClosed();
    });
  });

  it('should get user online status - none', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      // 👇 MOCK LAST SEEN WHEN SOCKETS CLOSE
      spyUpdateLastSeen.mockImplementation(async () => done());

      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'ONLINE',
            to: to.id,
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: 'ONLINE',
            content: {
              id: to.id,
              online: 'NONE',
            },
            from: serverName,
          });
        })
        .close()
        .expectClosed();
    });
  });

  it('should get user online status - typing', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to).sendText(
        helpers.constructMessage({
          type: 'TYPING',
        }),
      );

      // 👇 MOCK LAST SEEN WHEN SOCKETS CLOSE
      spyUpdateLastSeen.mockImplementation(async (id) => {
        if (id === from.id) {
          toSocket.close();
        } else if (id === to.id) {
          done();
        }
      });

      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'ONLINE',
            to: to.id,
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: 'ONLINE',
            content: {
              id: to.id,
              online: 'TYPING',
            },
            from: serverName,
          });
        })
        .close()
        .expectClosed();
    });
  });

  it('should get user online status - last seen', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const spyFindOne = jest.spyOn(helpers.entityManager, 'findOne').mockClear();

      spyUpdateLastSeen.mockRestore();
      await mockDate(async () => await helpers.updateLastSeen(to.id));

      // 👇 MOCK LAST SEEN WHEN SOCKETS CLOSE
      spyUpdateLastSeen = jest.spyOn(helpers, 'updateLastSeen').mockImplementation(async () => done());

      const sendText = () =>
        helpers.constructMessage({
          type: 'ONLINE',
          to: to.id,
        });
      const expectText = (data: string) => {
        const message = deconstructMessage(data);
        expect(message).toMatchObject<SocketMessage>({
          type: 'ONLINE',
          content: {
            id: to.id,
            online: testDate.getTime().toString(),
          },
          from: serverName,
        });
      };

      await wsClient(from)
        .sendText(sendText())
        .expectText((data) => {
          expectText(data);
          expect(spyFindOne).toHaveBeenCalledTimes(1);
          expect(spyFindOne).toHaveBeenCalledWith(User, {
            where: { id: to.id },
            select: { active: true },
          });
          spyFindOne.mockClear();
        })
        // SHOULD READ LAST SEEN FROM CACHE
        .sendText(sendText())
        .expectText((data) => {
          expectText(data);
          expect(spyFindOne).toHaveBeenCalledTimes(0);
        })
        .close()
        .expectClosed();
    });
  });

  it('should set user conversation to seen', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      // 👇 SEND MESSAGE TO CREATE AN UNSEEN CONVERSATION
      await helpers.createMessage(to, from);
      spyPublish.mockClear();

      // 👇 MOCK LAST SEEN WHEN SOCKETS CLOSE
      spyUpdateLastSeen.mockImplementation(async () => {
        // 👇 CHECK PUBLISHED NOTIFICATION FOR SEEN CONVERSATION
        expect(spyPublish).toHaveBeenCalledTimes(1);
        expect(spyPublish).toHaveBeenCalledWith(Publish.CONVERSATIONS, {
          [Publish.CONVERSATIONS]: expect.objectContaining<Partial<Conversations>>({
            from: to.id,
            to: from.id,
            unseen: 0,
            update: true,
          }),
        });

        done();
      });

      const fromSocket = await wsClient(from);
      spyPublish.mockImplementation(async () => fromSocket.close());
      // 👇 send seen conversation
      fromSocket.send(
        helpers.constructMessage({
          type: 'SEEN_CONVERSATION',
          content: to.id,
        }),
      );
    });
  });
});
