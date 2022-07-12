// 👇 Apollo & Graphql
import { gql } from 'apollo-server-express';
// 👇 Constants, Helpers & Types
import { maxLimit } from '../../constants';

const gqlPost = `
  id: ID!
  body: String!
  media: String
  createdDate: Date!
  createdBy: User!
  stats: Stats
`;

export default gql`
  scalar Date

  type Post {
    ${gqlPost}
    parent: Parent
  }

  type Parent {
    ${gqlPost}
  }

  type Stats {
    likes: Int
    comments: Int
    liked: Int
  }

  input PostInput {
    body: String!
    parent: ID
    id: ID # send post using authorized unique id
  }

  type Query {
    getPost(id: ID!): Post!
    getPosts(id: ID, limit: Int! = ${maxLimit}, offset: Int! = 0): [Post!]!
  }

  type Mutation {
    createPost(postInput: PostInput!): Post
    likePost(id: ID!): Boolean
    unLikePost(id: ID!): Boolean
  }
`;
