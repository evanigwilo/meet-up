// 👇 Middleware
import { auth } from '../../middleware/auth';
// 👇 Services
import { socket } from '../../services/client';
// 👇 Entities
import Post from '../../entity/Post';
// 👇 Constants, Helpers & Types
import { QueryMutation } from '../../types';
import { createNotification, entityManager, getImageFile, getMediaFile, mongoGetDb } from '../../helpers';
import { MediaCategory, UploadType, NotificationType, ModelType, ResponseCode } from '../../types/enum';
import { gqlError, limitOffset, queryPost, updateStats } from '.';

const resolver: QueryMutation = {
  Query: {
    getPosts: async (_, { id, limit, offset }, { req }) => {
      const posts = await limitOffset
        .builder(queryPost(id ? 'COMMENT' : 'POST', false, '', id).orderBy('post.createdDate', 'DESC'), limit, offset)
        .getMany();

      const user = auth(req);
      // 👇 update liked posts having current user
      await updateStats(posts, id, user?.id);

      return posts;
    },
    getPost: async (_, { id }, { req }) => {
      const post = await entityManager.findOne(Post, {
        // ['createdBy', 'likes', 'comments', 'comments.createdBy', 'comments.likes', 'comments.parent'];
        relations: {
          createdBy: true,
          parent: true,
          /* 
            likes: true,
            comments: true
          */
        },
        where: { id },
      });

      if (!post) {
        throw gqlError(ResponseCode.FORBIDDEN, _, {
          id,
          getPost: "Post or Reply doesn't exist.",
        });
      }

      const user = auth(req);
      // 👇 update liked posts having current user
      await updateStats(post, _, user?.id);

      return post;
    },
  },
  Mutation: {
    createPost: async (_, { postInput }, { req }) => {
      const { id } = postInput;

      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'createPost', { id });
      }

      // 👇 remove whitespaces from post body
      postInput.body = postInput.body.trim();

      const { body, parent } = postInput;

      if (!body) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          createPost: "Body shouldn't be empty.",
        });
      }

      let media;

      // 👇 if identifier for the post is provided
      if (id) {
        // 👇 get identifier from cache
        const value = await socket.get(id);

        if (value === UploadType.POST_MEDIA || value === UploadType.REPLY_MEDIA) {
          const mediaDb = mongoGetDb('media');
          // 👇 get media file matching identifier and current user data
          const file = await getMediaFile(mediaDb, id, {
            filename: id,
            'metadata.userId': user.id,
            'metadata.category': parent ? MediaCategory.REPLY : MediaCategory.POST,
          });

          if (!file) {
            throw gqlError(ResponseCode.FORBIDDEN, _, {
              id,
              createPost: 'Post media missing or User not matching metadata.',
            });
          }

          media = file.contentType;
        } else if (value === UploadType.POST_IMAGE || value === UploadType.REPLY_IMAGE) {
          const imageDb = mongoGetDb('image');
          // 👇 get image file matching identifier and current user data
          const file = await getImageFile(imageDb, parent ? ModelType.REPLY : ModelType.POST, {
            filename: id,
            'metadata.userId': user.id,
          });
          if (!file) {
            throw gqlError(ResponseCode.FORBIDDEN, _, {
              id,
              createPost: 'Post image missing or User not matching metadata.',
            });
          }
          media = file.image.contentType;
        } else {
          throw gqlError(ResponseCode.FORBIDDEN, _, {
            id,
            createPost: 'Post identifier is invalid.',
          });
        }
      }

      try {
        const post = await entityManager.save(Post, {
          // 👇 use provided identifier or default database generated identifier
          id: id || undefined,
          body,
          createdBy: user,
          parent: parent ? { id: parent } : undefined,
          media,
          stats: {
            likes: 0,
            comments: 0,
            liked: 0,
          },
        });

        // 👇 send notifications for only posts and not replies
        if (!parent) {
          createNotification(NotificationType.POST_CREATE, user, post.id);
        }

        return post;
      } catch {
        throw gqlError(ResponseCode.DATABASE_ERROR, _, {
          id,
          createPost: 'Failed to save post.',
        });
      }
    },
    likePost: async (_, { id }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'likePost', { id });
      }

      const post = await entityManager.findOne(Post, {
        relations: {
          createdBy: true,
          parent: true,
        },
        where: { id },
      });

      if (!post) {
        throw gqlError(ResponseCode.INPUT_ERROR, _, {
          id,
          likePost: 'Post identifier is invalid.',
        });
      }

      // 👇 like post if not liked
      const builder = entityManager.createQueryBuilder().relation(Post, 'likes').of(id);
      await builder.addAndRemove(user.id, user.id);

      /*
        const post = new Post({ id: postId });
        post.likes = [user];
        await entityManager.save(Post, post);
      */

      // 👇 send notifications if post is not a reply and current user is not the creator
      if (post.createdBy.id !== user.id && !post.parent) {
        createNotification(NotificationType.POST_LIKE, user, post.id, post.createdBy);
      }

      return true;
    },
    unLikePost: async (_, { id }, { req }) => {
      const user = auth(req);
      if (!user) {
        throw gqlError(ResponseCode.UNAUTHENTICATED, 'unLikePost', { id });
      }
      // 👇 unlike post if liked
      const builder = entityManager.createQueryBuilder().relation(Post, 'likes').of(id);
      await builder.remove(user.id);

      return true;
    },
  },
};

export default resolver;
