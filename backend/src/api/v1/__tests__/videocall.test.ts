// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Entities
import Message from '../entity/Message';
// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Constants, Helpers & Types
import * as helpers from '../helpers';
import { ResponseCode, Publish } from '../types/enum';
import { maxAge, missedVideoCall, serverName } from '../constants';
import { constructMessage, deconstructMessage } from '../helpers';
import { useTestServer, resolved, wsClient, conversationUsers, mockSleep } from './helpers';
import { Conversations, SocketMessage } from '../types';

// 👇 server start & stop hook
useTestServer();

describe('Video Call', () => {
  // 👇 MOCKING UPDATING LAST SEEN ON SOCKET CLOSE WHICH IS RESTORED AUTOMATICALLY AFTER TEST CLOSES
  Object.defineProperty(helpers, 'updateLastSeen', {
    value: () => undefined,
    writable: true,
  });

  // 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
  const spyPublish = jest.spyOn(pubsub, 'publish').mockImplementation(resolved);

  afterAll(() => {
    spyPublish.mockRestore();
  });

  it('should call a user who is online', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);
      const spyOnMessage = jest.fn();
      // 👇 PREVENT SAVING MISSED CALL
      const spySleep = mockSleep('REJECTED');

      toSocket.onmessage = ({ data }) => {
        spyOnMessage();
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'CALL_OFFER',
          content: {
            signal: 'signal...',
            name: from.name,
          },
          to: to.id,
          from: from.id,
        });
        toSocket.close();
      };

      toSocket.onclose = () => {
        expect(spyOnMessage).toHaveBeenCalledTimes(1);
        expect(spySleep).toHaveBeenCalledTimes(1);
        expect(spySleep).toHaveBeenCalledWith(60);
        spySleep.mockRestore();
        // 👇 CHECK PUBLISHED NOTIFICATIONS
        expect(spyPublish).toHaveBeenCalledTimes(0);
        done();
      };

      spyPublish.mockClear();
      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'CALL_OFFER',
            to: to.id,
            content: 'signal...',
          }),
        )
        .close()
        .expectClosed();
    });
  });

  it('should call a user who is offline', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'CALL_OFFER',
            to: to.id,
            content: 'signal...',
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: 'USER_OFFLINE',
            from: serverName,
          });
        })
        .close()
        .expectClosed();

      done();
    });
  });

  it('should call a user who is busy', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);
      // 👇 PREVENT SAVING MISSED CALL
      const spySleep = mockSleep('REJECTED');

      toSocket.onmessage = ({ data }) => {
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'CALL_OFFER',
          content: {
            signal: 'signal...',
            name: from.name,
          },
          to: to.id,
          from: from.id,
        });

        toSocket.send(
          constructMessage({
            type: 'USER_BUSY',
          }),
        );
      };
      toSocket.onclose = () => fromSocket.close();

      const fromSocket = await wsClient(from).sendText(
        helpers.constructMessage({
          type: 'CALL_OFFER',
          to: to.id,
          content: 'signal...',
        }),
      );
      fromSocket.onmessage = ({ data }) => {
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'USER_BUSY',
          from: to.id,
        });

        toSocket.close();
      };
      fromSocket.onclose = () => {
        spySleep.mockRestore();
        done();
      };
    });
  });

  it('should call a user and cancel the call', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);
      const spyOnMessage = jest.fn();
      // 👇 PREVENT SAVING MISSED CALL
      const spySleep = mockSleep('REJECTED');

      toSocket.onmessage = ({ data }) => {
        spyOnMessage();
        const message = deconstructMessage(data.toString());
        if (message.type === 'CALL_OFFER') {
          expect(message).toMatchObject<SocketMessage>({
            type: 'CALL_OFFER',
            content: {
              signal: 'signal...',
              name: from.name,
            },
            to: to.id,
            from: from.id,
          });
        } else {
          expect(message).toMatchObject<SocketMessage>({
            type: 'CALL_CANCELED',
            from: from.id,
          });
          toSocket.close();
        }
      };
      toSocket.onclose = () => {
        expect(spyOnMessage).toHaveBeenCalledTimes(2);
        spySleep.mockRestore();
        done();
      };

      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'CALL_OFFER',
            to: to.id,
            content: 'signal...',
          }),
        )
        .sendText(
          helpers.constructMessage({
            type: 'CALL_CANCELED',
          }),
        )
        .close()
        .expectClosed();
    });
  });

  it('should call a user and other user answers the call', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);
      // 👇 PREVENT SAVING MISSED CALL
      const spySleep = mockSleep('REJECTED');

      toSocket.onmessage = ({ data }) => {
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'CALL_OFFER',
          content: {
            signal: 'signal...',
            name: from.name,
          },
          to: to.id,
          from: from.id,
        });

        toSocket.send(
          constructMessage({
            type: 'ANSWER_OFFER',
            content: 'signal...',
          }),
        );
      };
      toSocket.onclose = () => fromSocket.close();

      const fromSocket = await wsClient(from).sendText(
        helpers.constructMessage({
          type: 'CALL_OFFER',
          to: to.id,
          content: 'signal...',
        }),
      );
      fromSocket.onmessage = ({ data }) => {
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'ANSWER_OFFER',
          content: 'signal...',
          from: to.id,
        });
        toSocket.close();
      };
      fromSocket.onclose = () => {
        spySleep.mockRestore();
        done();
      };
    });
  });

  it('should call a user when our session has expired', (done) => {
    conversationUsers().then(async ({ from }) => {
      const sessionExpired = Date.now() + maxAge * 2;
      const spyDate = jest.spyOn(global.Date, 'now').mockImplementation(() => sessionExpired);
      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'CALL_OFFER',
            to: faker.datatype.uuid(),
            content: 'signal...',
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: ResponseCode.UNAUTHENTICATED,
            from: serverName,
          });
        })
        .close()
        .expectClosed();

      spyDate.mockRestore();
      done();
    });
  });

  it('should call a user and send a missed call message when call is not answered', (done) => {
    conversationUsers().then(async ({ from, to }) => {
      const toSocket = await wsClient(to);
      const spyOnMessage = jest.fn();
      // 👇 RESOLVE TO SAVING MISSED CALL
      const spySleep = mockSleep('RESOLVED');

      toSocket.onmessage = ({ data }) => {
        spyOnMessage();
        const message = deconstructMessage(data.toString());
        expect(message).toMatchObject<SocketMessage>({
          type: 'CALL_OFFER',
          content: {
            signal: 'signal...',
            name: from.name,
          },
          to: to.id,
          from: from.id,
        });
      };

      toSocket.onclose = () => {
        expect(spyOnMessage).toHaveBeenCalledTimes(1);
        expect(spySleep).toHaveBeenCalledTimes(1);
        expect(spySleep).toHaveBeenCalledWith(60);
        spySleep.mockRestore();
        // 👇 CHECK PUBLISHED NOTIFICATIONS
        expect(spyPublish).toHaveBeenCalledTimes(2);
        expect(spyPublish).toHaveBeenNthCalledWith(1, Publish.MESSAGE, {
          [Publish.MESSAGE]: expect.objectContaining<Partial<Message>>({
            from: { id: from.id },
            to: { id: to.id },
            body: missedVideoCall,
            missed: true,
          }),
        });
        expect(spyPublish).toHaveBeenNthCalledWith(2, Publish.CONVERSATIONS, {
          [Publish.CONVERSATIONS]: expect.objectContaining<Partial<Conversations>>({
            from: from.id,
            to: to.id,
            unseen: 1,
            update: false,
          }),
        });
        done();
      };

      spyPublish.mockClear();
      await wsClient(from)
        .sendText(
          helpers.constructMessage({
            type: 'CALL_OFFER',
            to: to.id,
            content: 'signal...',
          }),
        )
        .expectText((data) => {
          const message = deconstructMessage(data);
          expect(message).toMatchObject<SocketMessage>({
            type: 'NO_ANSWER',
            from: serverName,
          });
        })
        .close()
        .expectClosed();

      toSocket.close();
    });
  });
});
