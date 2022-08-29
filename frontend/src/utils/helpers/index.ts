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

export const updateStyle = (
  element: ChildNode | HTMLElement | null | undefined,
  style: Partial<CSSStyleDeclaration>
) => {
  if (!element) {
    return;
  }

  const node = element as HTMLElement;
  for (const property in style) {
    node.style[property] = style[property] || "";
  }
};

export const updateProperty = (
  element: HTMLElement | null | undefined,
  style: Record<string, string>
) => {
  if (!element) {
    return;
  }

  for (const property in style) {
    element.style.setProperty(property, style[property]);
  }
};

export const navigationLink = (
  navigate: ReturnType<typeof useNavigate>,
  type: NotificationType["type"],
  identifier: string
) => {
  switch (type) {
    case "POST_CREATE":
    case "POST_LIKE":
      navigate(`/post/${identifier}`);
      break;
    case "PROFILE_UPDATE":
    case "FOLLOWING_YOU":
      const authPath =
        "/user/" +
        authKey(identifier) +
        identifier.substring(identifier.indexOf("/"));
      navigate(authPath);
      break;
    default:
      break;
  }
};

export const isMimeType = (
  type: "image" | "video" | "audio",
  value?: string | null
) => {
  if (!value) {
    return false;
  }
  switch (type) {
    case "image":
      return /^image/i.test(value);

    case "video":
      return /^video/i.test(value);

    case "audio":
      return /^audio/i.test(value);
    default:
      return false;
  }
};

// 👇 Randomize array in-place using Durstenfeld shuffle algorithm
export const shuffleArray = <T>(array: T[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

// 👇 websocket message helpers
export const constructMessage = (message: SocketMessage) =>
  JSON.stringify(message);

export const deconstructMessage = (message: string) =>
  JSON.parse(message) as SocketMessage;

export const authPath = (user: Store["user"] | UserSub) =>
  `/user/${user?.auth?.charAt(0)}/${user?.username}`;

// 👇 authentication method mapper for shorter url
export const authKey = (identifier: string) =>
  identifier.startsWith(AuthType.FACEBOOK)
    ? "f"
    : identifier.startsWith(AuthType.GOOGLE)
    ? "g"
    : "p"; // AuthType.PASSWORD

export const authProvider = (char?: string) =>
  char === "f"
    ? AuthType.FACEBOOK
    : char === "g"
    ? AuthType.GOOGLE
    : AuthType.PASSWORD;

export const avatarUrl = (user?: string, auth?: string) =>
  `${axios.defaults.baseURL}/image/avatar/${
    auth ? `${auth}/${user}` : user
  }?${Date.now()}`;

// 👇 auto format notification message
export const messageFormat = (format: NotifyFormat) => {
  const { type, name } = format;
  switch (type) {
    case "POST_CREATE":
      return {
        message: {
          text: name + " created a post.",
        },
        icon: { text: "✍︎", font: "1.2em" },
      };
    case "FOLLOWING_YOU":
      return {
        message: {
          text: name + " started following you.",
        },
        icon: { text: "👥", font: "1.2em" },
      };
    case "PROFILE_UPDATE":
      return {
        message: {
          text: "You updated your profile.",
        },
        icon: { text: "⚐", font: "1.2em" },
      };
    case "MISSED_CALL":
      return {
        message: {
          text: `Missed call from ${name}.`,
        },
        icon: { text: "✆", font: "1.5em" },
      };
    case "POST_LIKE":
      return {
        message: {
          text: name + " liked your post.",
        },
        icon: { text: "👍", font: "1em" },
      };

    default: // NEW_MESSAGE
      return {
        message: {
          text: name + " sent you a message.",
        },
        icon: { text: "@", font: "0.9em" },
      };
  }
};

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
