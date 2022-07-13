// 👇 Apollo & Graphql
import { gql } from 'apollo-server-express';
// 👇 Constants, Helpers & Types
import { maxLimit } from '../../constants';

export default gql`
  scalar Date

  type Message {
    id: ID!
    body: String
    from: User
    to: User
    createdDate: Date
    missed: Boolean
    deleted: Boolean
    media: String
    reactions: [Reaction]
    type: String # type of notification, missed call, new message or deleted message
  }

  type Reaction {
    id: ID!
    reaction: String!
    user: User!
    message: Message
    createdDate: Date!
  }

  type Conversation {
    id: ID
    from: User
    to: User
    message: Message
    seen: Boolean
  }

  input MessageInput {
    to: ID!
    body: String!
    missed: Boolean
    id: ID # send message using authorized unique id
  }

  type Query {
    getMessages(id: ID, limit: Int! = ${maxLimit}, offset: Int! = 0): [Message!]!
    getConversations(limit: Int! = ${maxLimit}, offset: Int! = 0): [Conversation!]!
  }

  type Mutation {
    sendMessage(messageInput: MessageInput!): Message!
    deleteMessage(id: ID!): Message!
    addReactionMessage(id: ID!, reaction: String!): Reaction!
    removeReactionMessage(id: ID!): Boolean!
  }
`;
