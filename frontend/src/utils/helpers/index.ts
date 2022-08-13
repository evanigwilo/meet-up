// 👇 Apollo & Graphql
import { ApolloError, gql } from "@apollo/client";
// 👇 React Router
import { useNavigate } from "react-router-dom";
// 👇 Numeral
import numeral from "numeral";
// 👇 Services
import axios from "../../services/axios";
// 👇 Faker
import { faker } from "@faker-js/faker";
// 👇 Constants, Helpers & Types
import {
  GqlQueries,
  NotificationType,
  SocketMessage,
  TestObserver,
  Store,
  UserSub,
  NotifyFormat,
} from "../types";
import { AuthType } from "../types/enum";
import {
  gqlQueries,
  gqlUser,
  gqlUserSub,
  REACT_APP_SERVER_API_VERSION,
  REACT_APP_SERVER_HOST,
  REACT_APP_SERVER_PATH,
  REACT_APP_SERVER_PORT,
  REACT_APP_SERVER_PROTOCOL,
} from "../constants";

// 👇 seconds to milliseconds convert for intervals
export const secsToMs = (secs: number) => secs * 1000;

export const sleep = (secs: number) =>
  new Promise((handler) => window.setTimeout(handler, secsToMs(secs)));

// 👇 helper to monitor mutation and method calls
export const testObserver = (status: TestObserver) => {};

export const randomNumber = (max = 30) => Math.floor(Math.random() * max);

export const apiUrl = (socketProtocol = false, socketPath = false) =>
  `${
    socketProtocol
      ? REACT_APP_SERVER_PROTOCOL === "http"
        ? "ws"
        : "wss"
      : REACT_APP_SERVER_PROTOCOL
  }://${REACT_APP_SERVER_HOST}:${REACT_APP_SERVER_PORT}${REACT_APP_SERVER_PATH}${
    socketPath ? "/" : REACT_APP_SERVER_API_VERSION
  }`;

// 👇 error formatter for apollo message
export const apolloErrorMessage = (
  error: Partial<ApolloError>,
  query: string
) => {
  const network = error.networkError?.message;
  const errors = error.graphQLErrors?.[0];
  const message = errors?.message;
  const extensions = errors?.extensions;
  const id = extensions?.id as string | undefined;
  return {
    id,
    message:
      network ||
      (extensions?.[query] as string | undefined) ||
      message ||
      error.message ||
      "",
  };
};
// 👇 queries helper
export const gqlQuery = (query: GqlQueries) => {
  switch (query) {
    case "auth":
      return gql`
        query auth {
          auth {
            ${gqlUser}
          }
        }
      `;

    case "findUser":
      return gql`
        query findUser($handle: String!) {
          findUser(handle: $handle) {
            ${gqlUserSub}
          }
        }
        `;

    case "getConversations":
    case "getNotifications":
      return queryAuthPaginate({
        query,
        id: false,
        auth: false,
        paginate: true,
      });

    case "getPosts":
    case "getMessages":
      return queryAuthPaginate({
        query,
        id: true,
        auth: false,
        paginate: true,
      });

    case "getPost":
      return queryAuthPaginate({
        query,
        id: "REQUIRED",
        auth: false,
        paginate: false,
      });

    case "getFollowing":
    case "getUserLikes":
    case "getFollowers":
    case "getUserPosts":
    case "getUserComments":
    case "getUserMedias":
      return queryAuthPaginate({
        query,
        id: false,
        auth: true,
        paginate: true,
      });

    case "getUser":
    case "getFollowCount":
    case "getFollowStatus":
      return queryAuthPaginate({
        query,
        id: false,
        auth: true,
        paginate: false,
      });

    default:
      return gql``;
  }
};

// 👇 query generator function
const queryAuthPaginate = ({
  query,
  id,
  auth,
  paginate,
}: {
  query: GqlQueries;
  id?: boolean | "REQUIRED";
  auth?: boolean;
  paginate?: boolean;
}) => {
  const _id = !id ? "" : id === "REQUIRED" ? "$id: ID!," : "$id: ID,";
  const _auth = auth ? "$authInput: AuthInput!," : "";
  const _paginate = paginate ? "$limit: Int, $offset: Int" : "";

  const __id = id ? "id: $id," : "";
  const __auth = auth ? "authInput: $authInput," : "";
  const __paginate = paginate ? "limit: $limit, offset: $offset" : "";

  return gql`
    query ${query}(${_id + _auth + _paginate}) {
      ${query}(${__id + __auth + __paginate}) {
        ${gqlQueries[query]}
      }
    }
    `;
};
