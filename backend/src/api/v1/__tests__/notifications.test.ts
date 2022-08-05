// 👇 Faker
import { faker } from '@faker-js/faker';
import { ResponseCode, MessageType, NotificationType, Publish } from '../types/enum';
// 👇 Entities
import Notification from '../entity/Notification';
import Message from '../entity/Message';
import User from '../entity/User';
// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Constants, Helpers & Types
import * as helpers from '../helpers';
import { msOneDay, testTime, maxLimit } from '../constants';
import { Conversations, Reacted } from '../types';
import {
  useTestServer,
  graphQLSocket,
  graphQLRequest,
  loginUser,
  testSuccess,
  testError,
  testPagination,
  resolved,
  mockSleep,
} from './helpers';

// 👇 server start & stop hook
useTestServer();

const bulkNotification = async (userA: User, userB: User, total: number, seen = false) => {
  const notifications: Partial<Notification>[] = [];

  for (let i = 0; i < total; i++) {
    const rand = faker.datatype.number({
      min: 0,
      max: total,
    });
    // 👇 random notification type
    const type =
      rand % 2 === 0
        ? NotificationType.FOLLOWING_YOU
        : rand % 3 === 0
        ? NotificationType.POST_CREATE
        : rand % 4 === 0
        ? NotificationType.POST_LIKE
        : NotificationType.PROFILE_UPDATE;

    const dayOffset = msOneDay * i;
    const createdDate = new Date(testTime - dayOffset);

    notifications.push({
      id: faker.datatype.uuid(),
      identifier: faker.datatype.uuid(),
      from: userB,
      to: userA,
      type,
      createdDate,
      seen,
    });
  }

  await helpers.entityManager.createQueryBuilder().insert().into(Notification).values(notifications).execute();

  return notifications;
};

describe('User Notifications', () => {
  // 👇 SPY ON PUBSUB
  let spyPublish = jest.spyOn(pubsub, 'publish');

  it('should create a single user notification', (done) => {
    const type = NotificationType.PROFILE_UPDATE;
    const notification: Partial<Notification> = {
      type,
    };

    graphQLSocket<Notification>({
      subscription: Publish.NOTIFICATION,
      callback: async (user) => {
        const identifier = `${user.auth}/${user.username}`;
        notification.identifier = identifier;
        notification.from = { id: user.id, name: user.name };
        notification.to = { id: user.id };

        const prevCount = await helpers.entityManager.count(Notification);
        // 👇 notify user for updating profile or bio
        await helpers.createNotification(type, user, identifier, user);
        const currCount = await helpers.entityManager.count(Notification);
        expect(currCount).toEqual(prevCount + 1);
      },
      next: (data) => {
        expect(data).toMatchObject(notification);
        done();
      },
    });
  });

  it('should create a batch user notification', async () => {
    const type = NotificationType.POST_CREATE;
    const user = await helpers.createUser();
    const batchIntervals = 2;
    const followCount = maxLimit * batchIntervals;
    const followers = await helpers.bulkUserFollowers(user, followCount);
    // 👇 MAP FOLLOWERS FOR FASTER SEARCH
    const mapFollower = followers.reduce<Set<string>>((output, { id }) => output.add(id), new Set<string>());
    expect(mapFollower.size).toEqual(followCount);

    const post = await helpers.createPost(user);
    const identifier = post.id;
    // 👇 PREVENT DETECTION OPEN HANDLES FROM PUBSUB
    spyPublish.mockClear().mockImplementation(resolved);
    // 👇 RESOLVE TO SAVING MISSED CALL
    const spySleep = mockSleep('RESOLVED');
    const prevCount = await helpers.entityManager.count(Notification);
    // 👇 notify users following this user for a created post
    await helpers.createNotification(type, user, identifier);
    const currCount = await helpers.entityManager.count(Notification);
    expect(currCount).toEqual(prevCount + followCount);
    expect(spySleep).toHaveBeenCalledTimes(batchIntervals);
    spySleep.mockRestore();
    const callsPublish = spyPublish.mock.calls;
    expect(callsPublish).toHaveLength(followCount);
    // 👇 CHECK PUBLISHED NOTIFICATION FOR TO FOLLOWERS
    callsPublish.forEach((call) => {
      const { notification } = call[1] as { notification: Partial<Notification> };
      expect(notification.type).toEqual(type);
      expect(notification.identifier).toEqual(identifier);
      expect(notification.from?.id).toEqual(user.id);
      expect(notification.from?.name).toEqual(user.name);
      expect(mapFollower.has(notification.to?.id as string)).toBe(true);
    });
    spyPublish.mockRestore();
    spyPublish = jest.spyOn(pubsub, 'publish').mockClear();
  });

  it('should get a user notifications', (done) => {
    const notification: Partial<Notification> = {
      type: 'VIEWED',
    };

    graphQLSocket<Notification>({
      subscription: Publish.NOTIFICATION,
      callback: async (userA) => {
        const viewed = maxLimit;
        notification.viewed = viewed;
        notification.to = { id: userA.id };

        const headers = await loginUser(userA);
        const userB = await helpers.createUser();

        // 👇 notify a unseen notifications for userA who is currently logged in
        const notifications = await bulkNotification(userA, userB, viewed);
        const request = await graphQLRequest<Notification[]>('getNotifications', {}, headers);
        const body = request.body;
        testSuccess(request);
        expect(body).toHaveLength(viewed);
        body?.forEach((notification, index) => {
          expect(notification.id).toEqual(notifications[index].id);
        });
      },
      next: (data) => {
        expect(data).toEqual(notification);
        done();
      },
    });
  });

  it('should get a user notifications with pagination', async () => {
    const userA = await helpers.createUser();
    const userB = await helpers.createUser();
    const headers = await loginUser(userA);
    // 👇 create seen notifications for testing pagination
    const notifications = await bulkNotification(userA, userB, maxLimit * 2, true);
    spyPublish.mockClear();
    await testPagination('getNotifications', notifications, {}, headers);
    expect(spyPublish).toHaveBeenCalledTimes(0);
  });

  it('should get a user notifications with errors', async () => {
    const request = await graphQLRequest<Notification[]>('getNotifications');
    testError(request, ResponseCode.UNAUTHENTICATED, 'getNotifications');
  });

  it('should send notification for following a user ', (done) => {
    const notification: Partial<Notification> = {
      id: faker.datatype.uuid(),
      type: NotificationType.FOLLOWING_YOU,
    };

    graphQLSocket<Notification>({
      subscription: Publish.NOTIFICATION,
      callback: async (userA) => {
        // 👇 userB follows userA who is currently logged in
        const userB = await helpers.createUser();
        /*
          await helpers.createNotification(
            NotificationType.FOLLOWING_YOU,
            userB,
            `${userB.auth}/${userB.username}`,
            userA,
          );
        */
        notification.from = { id: userB.id };
        notification.to = { id: userA.id };
        notification.identifier = `${userA.auth}/${userA.username}`;
        pubsub.publish(Publish.NOTIFICATION, {
          notification,
        });
      },
      next: (data) => {
        expect(data).toEqual(notification);
        done();
      },
    });
  });

  it('should send notification for a conversation', (done) => {
    const conversations: Partial<Conversations> = {
      unseen: 0,
      update: false,
    };

    graphQLSocket<Conversations>({
      subscription: Publish.CONVERSATIONS,
      callback: async (userA) => {
        // 👇 notify a conversation when userB sends a new message to userA who is currently logged in
        const userB = await helpers.createUser();
        conversations.from = userB.id;
        conversations.to = userA.id;
        pubsub.publish(Publish.CONVERSATIONS, {
          [Publish.CONVERSATIONS]: conversations,
        });
      },
      next: (data) => {
        expect(data).toEqual(conversations);
        done();
      },
    });
  });

  it('should send notification for a reaction', (done) => {
    const reaction: Partial<Reacted> = {
      message: faker.datatype.uuid(),
      deleted: false,
      reaction: 'like',
    };

    graphQLSocket<Reacted>({
      subscription: Publish.REACTED,
      callback: async (userA) => {
        // 👇 notify userB reacting to a message from userA who is currently logged in
        const userB = await helpers.createUser();
        reaction.from = userA.id;
        reaction.user = userB.id;
        reaction.to = userB.id;
        pubsub.publish(Publish.REACTED, {
          [Publish.REACTED]: reaction,
        });
      },
      next: (data) => {
        expect(data).toEqual(reaction);
        done();
      },
    });
  });

  it('should send mew message with subscription', (done) => {
    const message: Partial<Message> = {
      id: faker.datatype.uuid(),
      body: faker.random.words(10),
      type: MessageType.DELETED_MESSAGE,
      missed: false,
      deleted: false,
    };

    graphQLSocket<Message>({
      subscription: Publish.MESSAGE,
      callback: async (userA) => {
        // 👇 notify sending a new message form userB to userA who is currently logged in
        const userB = await helpers.createUser();
        message.from = { id: userB.id };
        message.to = { id: userA.id };
        pubsub.publish(Publish.MESSAGE, {
          [Publish.MESSAGE]: message,
        });
      },
      next: (data) => {
        expect(data).toEqual(message);
        done();
      },
    });
  });
});
