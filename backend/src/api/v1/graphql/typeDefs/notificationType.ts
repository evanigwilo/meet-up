// 👇 Apollo & Graphql
import { gql } from 'apollo-server-express';
// 👇 Constants, Helpers & Types
import { maxLimit } from '../../constants';

export default gql`
  scalar Date

  type Notification {
    id: ID
    from: User
    to: User
    identifier: String
    seen: Boolean
    createdDate: Date
    type: String!
    viewed: Int
  }

  type Notifications {
    total: Int!
    type: String
  }

  type Conversations {
    unseen: Int!
    update: Boolean!
    from: ID!
    to: ID!
  }

  type Reacted {
    reaction: String
    deleted: Boolean!
    message: String!
    from: String!
    to: String!
    user: String!
  }

  type Query {
    getNotifications(limit: Int! = ${maxLimit}, offset: Int! = 0): [Notification!]!
  }

  type Subscription {
    message: Message!
    reacted: Reacted!
    notification: Notification!
    conversations: Conversations!
  }
`;
