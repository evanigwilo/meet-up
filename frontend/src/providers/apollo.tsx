// 👇 React
import { ReactNode } from "react";
// 👇 Apollo & Graphql
import { split, HttpLink, disableFragmentWarnings } from "@apollo/client";
import {
  getMainDefinition,
  offsetLimitPagination,
} from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client";
// 👇 Context
import WsProvider from "./ws";
// 👇 Constants, Helpers & Types
import { apiUrl } from "../utils/helpers";
import { GqlQueries } from "../utils/types";

const httpLink = new HttpLink({
  uri: apiUrl(),
  // 👇 for cookies to work
  credentials: "include",
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: apiUrl(true),
    /*
    connectionParams: {
      authToken: "authToken",
    },
    */
  })
);

/*
The split function takes three parameters:
* A function that's called for each operation to execute
* The Link to use for an operation if the function returns a "truthy" value
* The Link to use for an operation if the function returns a "falsy" value
*/
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

// 👇 pagination helper for queries using cache
const pagination = offsetLimitPagination();

const paginatedFields: Partial<Record<GqlQueries, typeof pagination>> = {
  getPosts: pagination,
  getUserPosts: pagination,
  getUserComments: pagination,
  getUserMedias: pagination,
  getUserLikes: pagination,
  getFollowers: pagination,
  getFollowing: pagination,
  getConversations: pagination,
  getNotifications: pagination,
};

export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        getMessages: {
          read(existing, { args }) {
            // A read function should always return undefined if existing is
            // undefined. Returning undefined signals that the field is
            // missing from the cache, which instructs Apollo Client to
            // fetch its value from your GraphQL server.
            // console.log({ existing, args });

            return existing;
          },

          // The keyArgs list and merge function are the same as above.
          keyArgs: [],
          merge(existing: [] | undefined, incoming: [], { args }) {
            return [...(existing || []), ...incoming];
          },
        },
        ...paginatedFields,
      },
    },
  },
});

const client = new ApolloClient({
  link: splitLink,
  cache,
});

// 👇 disable emitting of warning if you have multiple fragments of the same name.
disableFragmentWarnings();

const Provider = ({ children }: { children: ReactNode }) => (
  <ApolloProvider client={client}>
    <WsProvider>{children}</WsProvider>
  </ApolloProvider>
);

export default Provider;
