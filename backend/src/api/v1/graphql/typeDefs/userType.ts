// 👇 Apollo & Graphql
import { gql } from 'apollo-server-express';
// 👇 Constants, Helpers & Types
import { maxLimit } from '../../constants';

export default gql`
  scalar Date

  type User {
    id: ID!
    name: String
    email: String
    username: String
    gender: String
    createdDate: Date
    auth: String
    bio: String
    mutual: Boolean # mutual status relative to the current user
    token: ID # token for websocket authentication
    active: Date # user last seen
    notification: Boolean # show notifications option
    notifications: [Notifications] # notifications count
  }

  type Follow {
    following: Int!
    followers: Int!
  }

  input UserInput {
    name: String!
    username: String!
    password: String!
    email: String!
    gender: String
    bio: String
  }

  input AuthInput {
    auth: String!
    username: String!
  }

  type Query {
    auth: User!
    getUser(authInput: AuthInput!): User!
    getFollowCount(authInput: AuthInput!): Follow!
    getFollowStatus(authInput: AuthInput!): Follow!
    getFollowing(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [User!]!
    getFollowers(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [User!]!
    getUserPosts(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [Post!]!
    getUserComments(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [Post!]!
    getUserMedias(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [Post!]!
    getUserLikes(authInput: AuthInput!, limit: Int! = ${maxLimit}, offset: Int! = 0): [Post!]!
    findUser(handle: String!): [User!]!
  }

  type Mutation {
    register(userInput: UserInput!): User
    login(usernameOrEmail: String!, password: String!): User
    logout: Boolean
    followUser(authInput: AuthInput!): Boolean
    unFollowUser(authInput: AuthInput!): Boolean
    updateBio(bio: String!): Boolean!
    toggleNotification(toggle: Boolean!): Boolean!
  }
`;
