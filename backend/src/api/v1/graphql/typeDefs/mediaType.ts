// 👇 Apollo & Graphql
import { gql } from 'apollo-server-express';

export default gql`
  type MimeTypes {
    image: String!
    video: String!
    audio: String!
  }

  type Query {
    getMimeTypes: MimeTypes!
  }
`;
