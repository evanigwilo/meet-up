// 👇 Apollo & Graphql
import { AuthenticationError, UserInputError, ForbiddenError, ApolloError } from 'apollo-server-express';
import { GraphQLScalarType, Kind } from 'graphql';
// 👇 Typeorm
import { ILike, SelectQueryBuilder } from 'typeorm';
// 👇 Entities
import Post from '../../entity/Post';
import User from '../../entity/User';
// 👇 Constants, Helpers & Types
import { maxLimit } from '../../constants';
import { entityManager } from '../../helpers';
import { AuthInput } from '../../types';
import { ResponseCode } from '../../types/enum';

/*
take and skip may look like we are using limit and offset, but they aren't. 
limit and offset may not work as you expect once you have more complicated 
queries with joins or subqueries. Using take and skip will prevent those issues.
*/
export const limitOffset = {
  manager: (limit: number, offset: number) => ({
    take: Math.min(limit, maxLimit),
    skip: offset,
  }),
  builder: <T>(builder: SelectQueryBuilder<T>, limit: number, offset: number, raw = false) => {
    const parseLimit = Math.min(limit, maxLimit);
    return raw ? builder.limit(parseLimit).offset(offset) : builder.take(parseLimit).skip(offset);
  },
};

// 👇 query exists for the existence of any record in a subquery
export const existsQuery = <T>(builder: SelectQueryBuilder<T>) => `EXISTS (${builder.getQuery()})`;

// 👇 error generator for query or mutations
export const gqlError = (
  code: ResponseCode,
  query: string | undefined,
  extensions?: Record<string, string | undefined>,
) => {
  switch (code) {
    case ResponseCode.UNAUTHENTICATED:
      if (!query) {
        break;
      }
      return new AuthenticationError(ResponseCode.UNAUTHENTICATED, {
        [query]: 'User not authenticated.',
        ...extensions,
      });

    case ResponseCode.INPUT_ERROR:
      return new UserInputError(ResponseCode.INPUT_ERROR, extensions);

    case ResponseCode.FORBIDDEN:
      return new ForbiddenError(ResponseCode.FORBIDDEN, extensions);

    case ResponseCode.DATABASE_ERROR:
      return new ApolloError(ResponseCode.DATABASE_ERROR, '0', extensions);

    case ResponseCode.VALIDATION_ERROR:
      return new ApolloError(ResponseCode.VALIDATION_ERROR, '1', extensions);

    default:
      break;
  }
};

// 👇 posts query helper
export const queryPost = (option: 'POST' | 'COMMENT' | 'ALL', relation = false, alias = '', parent = '') => {
  const query = entityManager
    .createQueryBuilder(Post, `post${alias}`)
    .innerJoinAndSelect(`post${alias}.createdBy`, `createdBy${alias}`);

  if (relation) {
    query.leftJoinAndSelect(`post${alias}.likes`, `likes${alias}`);
    query.leftJoinAndSelect(`post${alias}.comments`, `comments${alias}`);
  }

  if (option === 'POST') {
    query.where(`post${alias}.parent IS NULL`);
  } else {
    query
      .leftJoinAndSelect(`post${alias}.parent`, `parent${alias}`)
      .leftJoinAndSelect(`parent${alias}.createdBy`, `parentCreatedBy${alias}`);

    if (relation) {
      query.leftJoinAndSelect(`parent${alias}.likes`, `parentLikes${alias}`);
      query.leftJoinAndSelect(`parent${alias}.comments`, `parentComments${alias}`);
    }

    if (option === 'COMMENT') {
      query.where(`post${alias}.parent${parent ? '.id = :parent' : ' IS NOT NULL'}`).setParameter('parent', parent);
    }
  }

  return query;
};

// 👇 posts stats helper
export const queryStats = (option: 'likes' | 'comments', postId: string) =>
  entityManager
    .createQueryBuilder(Post, 'post')
    .select('COUNT(*)')
    .innerJoin(`post.${option}`, option)
    .where(`post.id = '${postId}'`);

// 👇 update posts query helper
export const updateStats = async (post: Post | Post[], parent = '', userId = '') => {
  if (post instanceof Array) {
    let query = '';

    const { length } = post;

    if (!length) {
      return;
    }

    const replaceKey = 'REPLACE_KEY';
    const createQueryLike = queryStats('likes', replaceKey);
    const queryLikes = createQueryLike.getQuery();
    const queryLiked = userId ? createQueryLike.andWhere(`likes.id = '${userId}'`).getQuery() : '0';
    const queryComments = queryStats('comments', replaceKey).getQuery();

    for (let index = 0; index < length - 1; index++) {
      const { id } = post[index];
      query += `Select (${queryLikes.replace(replaceKey, id)}) as likes, (${queryComments.replace(
        replaceKey,
        id,
      )}) as comments, (${queryLiked.replace(replaceKey, id)}) as liked UNION ALL `;
    }
    const lastId = post[length - 1].id;
    query += `Select (${queryLikes.replace(replaceKey, lastId)}) as likes, (${queryComments.replace(
      replaceKey,
      lastId,
    )}) as comments, (${queryLiked.replace(replaceKey, lastId)}) as liked`;

    const result: typeof Post.prototype.stats[] = await entityManager.query(query);
    for (let index = 0; index < length; index++) {
      post[index].stats = result[index];
    }
    if (parent) {
      const stats: typeof Post.prototype.stats[] = await entityManager.query(
        `Select (${queryLikes.replace(replaceKey, parent)}) as likes, (${queryComments.replace(
          replaceKey,
          parent,
        )}) as comments, (${queryLiked.replace(replaceKey, parent)}) as liked`,
      );
      post.forEach(({ parent }) => {
        if (parent) {
          parent.stats = stats[0];
        }
      });
    }
  } else {
    const { id } = post;
    const createQueryLike = queryStats('likes', id);
    const queryLikes = createQueryLike.getQuery();
    const queryLiked = userId ? createQueryLike.andWhere(`likes.id = '${userId}'`).getQuery() : '0';
    const queryComments = queryStats('comments', id).getQuery();

    const result: typeof Post.prototype.stats[] = await entityManager.query(
      `Select (${queryLikes}) as likes, (${queryComments}) as comments, (${queryLiked}) as liked`,
    );
    /* 
      (`${queryLikes} UNION ALL ${queryComments}`);
    */
    post.stats = result[0];
  }
};

// 👇 user following/followers query helper
export const queryFollow = (select: 'following' | 'followers', id: string, count = false, order = true) => {
  const user = select === 'following' ? 'user' : 'following';
  const following = select === 'following' ? 'following' : 'user';

  const query = entityManager.createQueryBuilder();
  if (count) {
    query.select('COUNT(*)');
  } else {
    query
      // .select('followA.user', 'user')
      // .addSelect('followA.following', 'following')
      .addSelect(`followB.${user} IS NOT NULL`, 'mutual')
      .addSelect('users.*');
  }

  query
    .from('followers', 'followA')
    .innerJoin('users', 'users', `users.id = followA.${following}`)
    .leftJoin('followers', 'followB', `followB.${user} = followA.${following} and followB.${following}='${id}'`)
    .where(`followA.${user} = '${id}'`);

  if (order) {
    query.orderBy('users.createdDate', 'DESC');
  }

  return query;
};

// 👇 user finder helper
export const findUser = async (authInput: AuthInput) =>
  await entityManager.findOne(User, {
    where: {
      username: ILike(authInput.username),
      auth: authInput.auth,
    },
  });

export default {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date scalar type',
    serialize(value) {
      // 👇 Convert outgoing Date to integer for JSON
      return (typeof value === 'string' ? new Date(value) : (value as Date)).getTime();
    },
    parseValue(value) {},
    // @ts-ignore: Object is possibly 'null'.
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        // 👇 Convert hard-coded AST string to integer and then to Date
        return new Date(parseInt(ast.value, 10));
      }
      // 👇 Invalid hard-coded value (not an integer)
      return null;
    },
  }),
};
