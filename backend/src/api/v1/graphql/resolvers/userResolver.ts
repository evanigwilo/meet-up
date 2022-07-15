// 👇 Typeorm
import { Brackets, ILike } from 'typeorm';
// 👇 Generators & Validators
import argon2 from 'argon2';
import { isEmail, validate } from 'class-validator';
import { randomUUID } from 'crypto';
// 👇 Middleware
import { auth } from '../../middleware/auth';
// 👇 Services
import { socket } from '../../services/client';
// 👇 Entities
import User from '../../entity/User';
import Notification from '../../entity/Notification';
import Conversation from '../../entity/Conversation';
// 👇 Constants, Helpers & Types
import { WsAuth, QueryMutation } from '../../types';
import { AuthType, ResponseCode, NotificationType } from '../../types/enum';
import { createNotification, entityManager, msToSecs } from '../../helpers';
import { maxUsers, SESSION_ID } from '../../constants';
import { existsQuery, findUser, gqlError, limitOffset, queryFollow, queryPost, updateStats } from '.';

const resolver: QueryMutation = {
  Query: {
    auth: async (_, __, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'auth');
      }

      try {
        const notifications: User['notifications'] = await entityManager
          .createQueryBuilder(Notification, 'notification')
          .select('COUNT(*)', 'total')
          .addSelect('notification.type', 'type')
          .where('notification.to = :to', { to: user.id })
          .andWhere('notification.seen = :seen', { seen: false })
          .groupBy('type')
          .getRawMany();

        const conversations = await entityManager.count(Conversation, {
          relations: {
            to: true,
          },
          where: { to: { id: user.id }, seen: false },
        });

        // 👇 add unseen conversations to notification
        notifications.push({
          type: 'CONVERSATIONS',
          total: conversations,
        });

        // 👇 generate token for websocket authentication
        const token = randomUUID();
        const { cookie } = req.session;
        const value: WsAuth = {
          id: user.id,
          name: user.name,
          expires: cookie.expires?.getTime(),
          type: 'WS_AUTH_TOKEN',
        };

        await socket.hset(token, value);
        // @ts-ignore: Object is possibly 'null'.
        // 👇 expire cache key at the same expiry time of session
        await socket.expire(token, Math.floor(msToSecs(cookie.maxAge)));

        user.token = token;
        user.notifications = notifications;
      } catch {}

      return user;
    },
    getUser: async (_, { authInput }) => {
      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getUser: 'User not found.',
        });
      }

      return getUser;
    },
    getFollowCount: async (_, { authInput }) => {
      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getFollowCount: 'User not found.',
        });
      }

      // 👇 get count of user following and followers
      const queryFollowers = queryFollow('followers', getUser.id, true, false).getQuery();
      const queryFollowing = queryFollow('following', getUser.id, true, false).getQuery();

      const result: { count: string }[] = await entityManager.query(`${queryFollowers} UNION ALL ${queryFollowing}`);

      return {
        followers: Number(result[0].count),
        following: Number(result[1].count),
      };
    },
    getFollowStatus: async (_, { authInput }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'getFollowStatus');
      }

      const getUser = await findUser(authInput);
      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getFollowStatus: 'User not found.',
        });
      }

      if (user.id === getUser.id) {
        throw gqlError(ResponseCode.VALIDATION_ERROR, _, {
          getFollowStatus: "Can't check follow status on self.",
        });
      }

      // 👇 get count of user following, followers and mutuals
      const query = entityManager
        .createQueryBuilder()
        .select('followA.user', 'user')
        .addSelect('followA.following', 'following')
        // .select('COUNT(*)')
        .from('followers', 'followA')
        .leftJoin('followers', 'followB', 'followB.user = followA.following AND followB.following = followA.user')
        .where(`followA.user = '${user.id}' AND followA.following = '${getUser.id}'`)
        .orWhere(`followA.following = '${user.id}' AND followA.user = '${getUser.id}'`)
        .getQuery();

      const result: { user: string; following: string }[] = await entityManager.query(query);

      if (!result.length) {
        // 👇 no follow stats
        return {
          following: false,
          followers: false,
        };
      } else if (result.length === 2) {
        // 👇 mutuals
        return {
          following: true,
          followers: true,
        };
      } else {
        // 👇 following or follower
        const following = result[0].user === user.id;
        return {
          following,
          followers: !following,
        };
      }
    },
    getFollowing: async (_, { authInput, limit, offset }) => {
      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getFollowing: 'User not found.',
        });
      }

      // 👇 get users the user is following
      const following = (await entityManager.query(
        limitOffset.builder(queryFollow('following', getUser.id), limit, offset, true).getQuery(),
      )) as User[];

      return following;
    },
    getFollowers: async (_, { authInput, limit, offset }) => {
      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getFollowers: 'User not found.',
        });
      }

      // 👇 get users following the user
      const followers = (await entityManager.query(
        limitOffset.builder(queryFollow('followers', getUser.id), limit, offset, true).getQuery(),
      )) as User[];

      return followers;
    },
    getUserPosts: async (_, { authInput, limit, offset }, { req }) => {
      const user = auth(req);

      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getUserPosts: 'User not found.',
        });
      }

      // 👇 get user posts
      const posts = await limitOffset
        .builder(
          queryPost('POST').andWhere('createdBy.id = :id', { id: getUser.id }).orderBy('post.createdDate', 'DESC'),
          limit,
          offset,
        )
        .getMany();

      // 👇 update liked posts having current user
      await updateStats(posts, _, user?.id);

      return posts;
    },
    getUserMedias: async (_, { authInput, limit, offset }, { req }) => {
      const user = auth(req);

      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getUserMedias: 'User not found.',
        });
      }

      // 👇 get user posts having media
      const medias = await limitOffset
        .builder(
          queryPost('POST')
            .andWhere('createdBy.id = :id', { id: getUser.id })
            .andWhere('post.media IS NOT NULL')
            .orderBy('post.createdDate', 'DESC'),
          limit,
          offset,
        )
        .getMany();

      // 👇 update liked posts having current user
      await updateStats(medias, _, user?.id);

      return medias;
    },
    getUserComments: async (_, { authInput, limit, offset }, { req }) => {
      const user = auth(req);

      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getUserComments: 'User not found.',
        });
      }

      // 👇 get user replies
      const comments = await limitOffset
        .builder(
          queryPost('COMMENT').andWhere('createdBy.id = :id', { id: getUser.id }).orderBy('post.createdDate', 'DESC'),
          limit,
          offset,
        )
        .getMany();

      // 👇 update liked comments having current user
      await updateStats(comments, _, user?.id);

      return comments;
    },
    getUserLikes: async (_, { authInput, limit, offset }, { req }) => {
      const user = auth(req);

      const getUser = await findUser(authInput);

      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          getUserLikes: 'User not found.',
        });
      }

      // 👇 get posts/comments the user liked
      const likes = await limitOffset
        .builder(
          queryPost('ALL', true)
            .andWhere(
              existsQuery(
                queryPost('ALL', true, '_').andWhere('post_.id = post.id').andWhere('likes_.id = :id').take(1),
              ),
            )
            .setParameter('id', getUser.id)
            .orderBy('post.createdDate', 'DESC'),
          limit,
          offset,
        )
        .getMany();

      await updateStats(likes);

      // 👇 update liked posts/comments having current user
      await updateStats(likes, _, user?.id);

      return likes;
    },
    findUser: async (_, { handle }) => {
      const users = await entityManager.find(User, {
        where: [
          {
            username: ILike(`${handle}%`),
          },
          {
            name: ILike(`${handle}%`),
          },
        ],
        take: maxUsers,
      });

      return users;
    },
  },
  Mutation: {
    login: async (_, { usernameOrEmail, password }, { req }): Promise<User> => {
      const user = await entityManager.findOne(User, {
        where: {
          [isEmail(usernameOrEmail) ? 'email' : 'username']: ILike(usernameOrEmail),
          auth: AuthType.PASSWORD,
        },
      });

      if (!user) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          login: "Username or Email doesn't exist.",
        });
      }

      // 👇 verify hashed password
      const valid = await argon2.verify(user.password, password);
      if (!valid) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, { login: 'Incorrect password.' });
      }

      // 👇 save user session
      req.session.user = { ...user };

      return user;
    },
    register: async (_, { userInput }, { req }): Promise<User> => {
      let user = new User({ ...userInput, auth: AuthType.PASSWORD });

      // 👇 Validation only when using password authentication
      const errors = await validate(user);
      if (errors.length) {
        /*
          throw new UserInputError(
            'InputError',
            errors.map(({ constraints, property }) => ({ [property]: Object.values(constraints!)[0] })),
          );
        */

        const { constraints } = errors[0];
        for (const key in constraints) {
          // 👇 throw first error
          throw gqlError(ResponseCode.INPUT_ERROR, _, { register: constraints[key] });
        }
      }
      // 👇 check if users with the provided credential already exists
      const findUser = await entityManager
        .createQueryBuilder(User, 'user')
        .where('user.auth = :auth', { auth: AuthType.PASSWORD })
        .andWhere(
          new Brackets((qb) => {
            qb.where('user.email = :email', {
              email: user.email,
            }).orWhere('user.username = :username', { username: user.username });
          }),
        )
        .getOne();

      if (findUser) {
        throw gqlError(ResponseCode.FORBIDDEN, _, { register: 'Username or Email already exist.' });
      }

      try {
        user = await entityManager.save(user);

        // 👇 save user session
        req.session.user = { ...user };

        return user;
      } catch (error) {
        throw gqlError(ResponseCode.DATABASE_ERROR, _, { register: 'Failed to register user.' });
      }
    },
    logout: (_, __, { req, res, wsServer }): Boolean => {
      let status = true;

      // 👇 get user before destroying
      const user = auth(req);
      // 👇 clear cookie and close session
      res.clearCookie(SESSION_ID);
      req.session.destroy((err) => {
        status = Boolean(err);

        if (user) {
          // 👇 close all websocket instances if this user
          wsServer.clients.forEach((client) => {
            if (client.session.id === user.id && client.readyState === client.OPEN) {
              client.close(1000, ResponseCode.UNAUTHENTICATED);
            }
          });
        }
      });

      return status;
    },
    followUser: async (_, { authInput }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'followUser');
      }

      const getUser = await findUser(authInput);
      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          followUser: 'User not found.',
        });
      }

      if (user.id === getUser.id) {
        throw gqlError(ResponseCode.VALIDATION_ERROR, _, {
          followUser: "Can't follow self.",
        });
      }

      // 👇 follow user if not following
      const builder = entityManager.createQueryBuilder().relation(User, 'following').of(user.id);
      // 👇 removes then add command
      await builder.addAndRemove(getUser.id, getUser.id);

      // 👇 send notification to to the follower
      createNotification(NotificationType.FOLLOWING_YOU, user, `${user.auth}/${user.username}`, getUser);

      return true;
    },
    unFollowUser: async (_, { authInput }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'unFollowUser');
      }

      const getUser = await findUser(authInput);
      if (!getUser) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          unFollowUser: 'User not found.',
        });
      }

      if (user.id === getUser.id) {
        throw gqlError(ResponseCode.VALIDATION_ERROR, _, {
          unFollowUser: "Can't unfollow self.",
        });
      }

      // 👇 unfollow user if followed
      const builder = entityManager.createQueryBuilder().relation(User, 'following').of(user.id);
      await builder.remove(getUser.id);

      return true;
    },
    updateBio: async (_, { bio }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'updateBio');
      }

      await entityManager.update(User, { id: user.id }, { bio });

      // @ts-ignore: Object is possibly 'null'.
      // 👇 update bio in session
      req.session.user.bio = bio;

      // 👇 send notification to the current user
      createNotification(NotificationType.PROFILE_UPDATE, user, `${user.auth}/${user.username}`, user);

      return true;
    },
    toggleNotification: async (_, { toggle }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'toggleNotification');
      }

      await entityManager.update(
        User,
        { id: user.id },
        {
          notification: toggle,
        },
      );

      // @ts-ignore: Object is possibly 'null'.
      // 👇 update notification toggle in session
      req.session.user.notification = toggle;

      return toggle;
    },
  },
};

export default resolver;
