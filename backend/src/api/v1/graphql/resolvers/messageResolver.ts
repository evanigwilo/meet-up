// 👇 Typeorm
import { Brackets } from 'typeorm';
// 👇 Middleware
import { auth } from '../../middleware/auth';
// 👇 Services
import pubsub from '../../services/pubsub';
import { socket } from '../../services/client';
// 👇 Entities
import Message from '../../entity/Message';
import Reaction from '../../entity/Reaction';
import Conversation from '../../entity/Conversation';
// 👇 Constants, Helpers & Types
import { missedVideoCall } from '../../constants';
import { QueryMutation } from '../../types';
import { ResponseCode, MediaCategory, ModelType, Publish, UploadType } from '../../types/enum';
import { createReacted, entityManager, findMessage, getImageFile, getMediaFile, mongoGetDb } from '../../helpers';
import { gqlError, limitOffset } from '.';

const resolver: QueryMutation = {
  Query: {
    getMessages: async (_, { id, limit, offset }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'getMessages');
      }

      const query = entityManager
        .createQueryBuilder(Message, 'message')
        //👇 Disabled body selecting at schema for controlling deleted messages
        .addSelect('CASE WHEN message.deleted=TRUE THEN NULL ELSE message.body END', 'message_body')
        .innerJoinAndSelect('message.from', 'from')
        .innerJoinAndSelect('message.to', 'to')
        .leftJoinAndSelect('message.reactions', 'reactions')
        .leftJoinAndSelect('reactions.user', 'user');

      //👇 only messages between current user and other user
      if (id) {
        query
          .where(
            new Brackets((qb) => {
              qb.where('from.id = :fromA', { fromA: user.id })
                .andWhere('to.id = :toA', { toA: id })
                //👇 dont add missed call messages if from sender
                .andWhere('message.missed = :missed', { missed: false });
            }),
          )
          .orWhere(
            new Brackets((qb) => {
              qb.where('from.id = :fromB', { fromB: id }).andWhere('to.id = :toB', { toB: user.id });
            }),
          );
        //👇 all messages involving current user
      } else {
        query.where('from.id = :fromId', { fromId: user.id }).orWhere('to.id = :toId', { toId: user.id });
      }

      const messages = await limitOffset.builder(query, limit, offset).orderBy('message.createdDate', 'DESC').getMany();

      return messages;
    },
    getConversations: async (_, { limit, offset }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'getConversations');
      }

      /*
        //👇 Disabled body selecting at schema for controlling deleted messages
        const conversations = await entityManager.find(Conversation, {
          relations: {
            from: true,
            to: true,
            message: true,
          },
          where: [{ from: { id: user.id } }, { to: { id: user.id } }],
          ...limitOffset.manager(limit, offset),
        });
      */

      const query = entityManager
        .createQueryBuilder(Conversation, 'conversation')
        .addSelect('CASE WHEN message.deleted=TRUE THEN NULL ELSE message.body END', 'message_body')
        .innerJoinAndSelect('conversation.from', 'from')
        .innerJoinAndSelect('conversation.to', 'to')
        .leftJoinAndSelect('conversation.message', 'message')
        .where('from.id = :fromId', { fromId: user.id })
        .orWhere('to.id = :toId', { toId: user.id });

      const conversations = await limitOffset
        .builder(query, limit, offset)
        .orderBy('message.createdDate', 'DESC')
        .getMany();

      return conversations;
    },
  },
  Mutation: {
    sendMessage: async (_, { messageInput }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'sendMessage');
      }

      if (messageInput.missed) {
        messageInput.body = missedVideoCall;
      } else {
        messageInput.missed = false;
        // 👇 remove whitespaces from message body
        messageInput.body = messageInput.body?.trim();
      }
      const { id, body, to, missed } = messageInput;

      if (!body || !to) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          sendMessage: `${!body ? 'Body' : 'To'} shouldn't be empty.`,
        });
      }

      let media;

      // 👇 if identifier for the message is provided
      if (id) {
        // 👇 get identifier from cache
        const value = await socket.get(id);

        if (value === UploadType.MESSAGE_MEDIA) {
          const mediaDb = mongoGetDb('media');
          // 👇 get media file matching identifier and current user data
          const file = await getMediaFile(mediaDb, id, {
            filename: id,
            'metadata.userId': user.id,
            'metadata.category': MediaCategory.MESSAGE,
          });

          if (!file) {
            throw gqlError(ResponseCode.FORBIDDEN, _, {
              id,
              sendMessage: 'Message media missing or User not matching metadata.',
            });
          }
          media = file.contentType;
        } else if (value === UploadType.MESSAGE_IMAGE) {
          const imageDb = mongoGetDb('image');
          // 👇 get image file matching identifier and current user data
          const file = await getImageFile(imageDb, ModelType.MESSAGE, {
            filename: id,
            'metadata.userId': user.id,
          });
          if (!file) {
            throw gqlError(ResponseCode.FORBIDDEN, _, {
              id,
              sendMessage: 'Message image missing or User not matching metadata.',
            });
          }
          media = file.image.contentType;
        } else if (value !== 'MESSAGE') {
          throw gqlError(ResponseCode.FORBIDDEN, _, {
            id,
            sendMessage: 'Message identifier is invalid.',
          });
        }
      }

      try {
        const message = await entityManager.save(Message, {
          // 👇 use provided identifier or default database generated identifier
          id: id || undefined,
          from: user,
          to: { id: to },
          body,
          missed,
          media,
        });
        return message;
      } catch {
        throw gqlError(ResponseCode.DATABASE_ERROR, _, {
          id,
          sendMessage: 'Failed to save message.',
        });
      }
    },
    deleteMessage: async (_, { id }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'deleteMessage', { id });
      }

      // @ts-ignore: Object is possibly 'null'.
      // 👇 get message matching the provided identifier with current user as sender
      const message = await findMessage(id, user.id);

      if (!message) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          deleteMessage: "Message doesn't exist or User is not sender.",
        });
      }

      await entityManager.update(
        Message,
        { id: message.id },
        {
          // 👇 from, to, id; Needed for sending notifications
          from: message.from,
          to: message.to,
          id: message.id,
          deleted: true,
        },
      );

      return message;
    },
    addReactionMessage: async (_, { id, reaction }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'addReactionMessage', { id });
      }

      // @ts-ignore: Object is possibly 'null'.
      // 👇 get message matching the provided identifier with current user as sender or receiver
      const message = await findMessage(id, user.id, user.id);

      if (!message) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          addReactionMessage: "Message doesn't exist or User is not sender or receiver.",
        });
      }

      const createReaction = entityManager.create(Reaction, {
        message: { id },
        user,
        reaction,
      });

      // 👇 update or create reaction if not exist
      await entityManager.upsert(Reaction, createReaction, {
        //👇 If true, skip the update if no values would be changed (reduces writes)
        skipUpdateIfNoValuesChanged: true,
        //👇 column(s) name that you would like to ON CONFLICT
        conflictPaths: ['user', 'message'],
      });

      // 👇 send notifications to both users in the conversation
      pubsub.publish(Publish.REACTED, {
        [Publish.REACTED]: createReacted(message, user, reaction),
      });

      return createReaction;
    },
    removeReactionMessage: async (_, { id }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'removeReactionMessage', { id });
      }

      // 👇 get message matching the provided identifier with current user as sender or receiver
      // @ts-ignore: Object is possibly 'null'.
      const message = await findMessage(id, user.id, user.id);

      if (!message) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          removeReactionMessage: "Message doesn't exist or User is not sender or receiver.",
        });
      }

      // 👇 remove the reaction if exist
      await entityManager.delete(Reaction, {
        message: { id },
        user,
      });

      // 👇 send notifications to both users in the conversation
      pubsub.publish(Publish.REACTED, {
        [Publish.REACTED]: createReacted(message, user),
      });

      return true;
    },
  },
};

export default resolver;
