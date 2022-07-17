// 👇 Typeorm
import { In } from 'typeorm';
// 👇 Entities
import Notification from '../../entity/Notification';
import Message from '../../entity/Message';
// 👇 Apollo & Graphql
import { withFilter } from 'graphql-subscriptions';
// 👇 Services
import pubsub from '../../services/pubsub';
// 👇 Middleware
import { auth } from '../../middleware/auth';
// 👇 Constants, Helpers & Types
import { entityManager } from '../../helpers';
import { gqlError, limitOffset } from '.';
import { Conversations, QueryMutation, Reacted, Subscription } from '../../types';
import { ResponseCode, MessageType, NotificationType, Publish } from '../../types/enum';

const resolver: QueryMutation & Subscription = {
  Query: {
    getNotifications: async (_, { limit, offset }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'getNotifications');
      }

      const notifications = await entityManager.find(Notification, {
        relations: {
          from: true,
          to: true,
        },
        where: { to: { id: user.id } },
        order: {
          createdDate: 'DESC',
        },
        ...limitOffset.manager(limit, offset),
      });

      // 👇 count unseen notifications
      const unseen = notifications.reduce<string[]>((output, { id, seen }) => {
        if (!seen) {
          output.push(id);
        }
        return output;
      }, []);

      // 👇 set unseen notifications to seen before sending response
      if (unseen.length > 0) {
        entityManager
          .update(
            Notification,
            {
              id: In(unseen),
            },
            {
              seen: true,
            },
          )
          .then(() => {
            // 👇 send notification for seen notifications
            const notification: Partial<Notification> = {
              to: { id: user.id },
              type: 'VIEWED',
              viewed: unseen.length,
            };
            pubsub.publish(Publish.NOTIFICATION, {
              [Publish.NOTIFICATION]: notification,
            });
          });
      }

      return notifications;
    },
  },
  Subscription: {
    notification: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(Publish.NOTIFICATION),
        ({ notification }: { notification: Notification }, _, { user, expires }) => {
          // 👇 no user or session expired
          if (!user || Date.now() > (expires || 0)) {
            return false;
          }

          const { to, type } = notification;

          switch (type) {
            case 'VIEWED':
            case NotificationType.FOLLOWING_YOU:
            case NotificationType.POST_LIKE:
            case NotificationType.PROFILE_UPDATE:
            case NotificationType.POST_CREATE:
              return user.id === to.id;
            default:
              return false;
          }
        },
      ),
    },
    conversations: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(Publish.CONVERSATIONS),

        ({ conversations }: { conversations: Conversations }, _, { user, expires }) => {
          // 👇 no user or session expired
          if (!user || Date.now() > (expires || 0)) {
            return false;
          }

          const { to } = conversations;
          return user.id === to;
        },
      ),
    },
    reacted: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(Publish.REACTED),

        ({ reacted }: { reacted: Reacted }, _, { user, expires }) => {
          // 👇 no user or session expired
          if (!user || Date.now() > (expires || 0)) {
            return false;
          }
          const { from, to } = reacted;

          return user.id === from || user.id === to;
        },
      ),
    },
    message: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(Publish.MESSAGE),
        ({ message }: { message: Message }, _, { user, expires }) => {
          // 👇 no user or session expired
          if (!user || Date.now() > (expires || 0)) {
            return false;
          }

          const { from, to, type } = message;
          switch (type) {
            case MessageType.NEW_MESSAGE:
            case MessageType.MISSED_CALL:
              return user.id === to.id;
            case MessageType.DELETED_MESSAGE:
              return user.id === from.id || user.id === to.id;

            default:
              return false;
          }
        },
      ),
    },
  },
};

export default resolver;
