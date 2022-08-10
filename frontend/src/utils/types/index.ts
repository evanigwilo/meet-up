// 👇 Apollo & Graphql
import { ObservableQuery } from "@apollo/client";
// 👇 Peer
import Peer from "simple-peer";
// 👇 Constants, Helpers & Types
import { ActionType, AuthType, Gender } from "./enum";
import { gqlMutations, gqlQueries, reactions } from "../constants";

export type Variables = Record<
  string,
  string | number | boolean | AuthInput | KeyValue<string | number | boolean>
>;

export type GqlQueries = keyof typeof gqlQueries;
export type GqlMutations = keyof typeof gqlMutations;

export type GqlQueryMore = typeof ObservableQuery.prototype.fetchMore;

export type GqlQuery = typeof ObservableQuery.prototype.refetch;

export type ReactionKeys = keyof typeof reactions;

export type AuthRoute = "Sign Up" | "Login";

export type Follow = Record<"followers" | "following", number>;

export type AuthCredentials = Partial<{
  name: string;
  email: string;
  username: string;
  password: string;
  gender: string;
  bio: string;
  usernameOrEmail: string;
}>;

export type MessageInput = {
  id: string;
  body: string;
  to: string;
};

export type UserSub = {
  __typename?: string;
  id: string;
  name: string;
  username: string;
  auth: AuthType;
  createdDate: string;
  active: string | null;
};

export type UserType = UserSub & {
  email: string;
  gender: Gender;
  bio: string | null;
  mutual?: boolean;
  token: string | null;
  notification: boolean;
  notifications?: {
    total: number;
    type: NotificationType["type"] | "CONVERSATIONS";
  }[];
};

export type PostType = {
  __typename?: string;
  id: string;
  body: string;
  media: string | null;
  createdDate: string;
  parent: {
    __typename?: string;
    id: string;
    stats?: {
      __typename?: string;
      likes: number;
      comments: number;
      liked: number;
    };
  } | null;
  createdBy: UserSub;
  stats: {
    __typename?: string;
    likes: number;
    comments: number;
    liked: number;
  };
};

export type MessageType = {
  __typename?: string;
  id: string;
  body: string | null;
  from: Partial<UserSub>;
  to: {
    __typename?: string;
    id?: string;
  };
  createdDate: string;
  deleted: boolean;
  missed: boolean;
  media: string | null;
  reactions: ReactionType[] | null;
  type: "NEW_MESSAGE" | "MISSED_CALL" | "DELETED_MESSAGE";
};

export type ConversationType = {
  __typename?: string;
  id: string;
  from: Partial<UserSub>;
  to: Partial<UserSub>;
  seen: boolean;
  message: {
    __typename?: string;
    id: string;
    body: string | null;
    createdDate: string;
    missed: boolean;
    deleted: boolean;
    media: string | null;
  };
};

export type ConversationsType = {
  __typename?: string;
  unseen: number;
  update: boolean;
  from: string;
  to: string;
};

export type ReactionType = {
  __typename?: string;
  id: string;
  reaction: ReactionKeys;
  user: Partial<UserSub>;
  createdDate: string;
  message: {
    __typename?: string;
    id: string;
  } | null;
};

export type ReactedType = {
  reaction: ReactionKeys;
  deleted: boolean;
  message: string;
  from: string;
  to: string;
  user: string;
};

export type NotificationType = {
  __typename?: string;
  id: string;
  from: UserSub;
  to: UserSub;
  seen: boolean;
  viewed: number;
  identifier: string;
  createdDate: string;
  type:
    | "POST_CREATE"
    | "POST_LIKE"
    | "FOLLOWING_YOU"
    | "PROFILE_UPDATE"
    | "VIEWED";
};

export type Spacing = {
  margin?: string;
  padding?: string;
};

export type KeyValue<T = string> = {
  [key: string | number]: T;
};

/*
export type RecursiveKeyValue<
  T = string | boolean | number | null | undefined
> = {
  [key: string | number]: RecursiveKeyValue | T;
};
*/

export type Ellipsis = 1 | 2 | 3;

export type SocketMessage = {
  type: SocketMessageType;
  content?: unknown;
  from?: string;
  to?: string;
};

export type AuthInput = {
  auth?: AuthType;
  username?: string;
};

export type BuildPost = {
  width: string;
  height: number;
  depth: number;
  post: PostType;
};

export type Store = Partial<{
  user: Omit<UserType, "notifications"> & {
    notifications: number;
    conversations: number;
  };
  answer: {
    signal: Peer.SignalData;
    from: string;
    name: string;
  };
  modal: Partial<{
    disabled: boolean;
    visible: boolean;
    logo: boolean;
    text: boolean;
  }>;
  chat: UserType;
  media: string;
  reply: string;
  authenticating: boolean;
}>;

export type Action = {
  type: ActionType;
  payload: any;
};

export type DispatchCreator = (type: ActionType, payload?: any) => void;

export type InputType = HTMLTextAreaElement & {
  setValue: (value: string) => void;
};

export type RowType = Partial<{
  highlight: boolean;
  backgroundLoading: boolean;
  hover: boolean;
}>;

export type NotifyFormat = Partial<{
  type: NotificationType["type"] | MessageType["type"];
  name: string;
}>;

export type InputElement = HTMLInputElement | HTMLTextAreaElement;

export enum UploadType {
  MESSAGE_MEDIA = "MESSAGE_MEDIA",
  POST_MEDIA = "POST_MEDIA",
  REPLY_MEDIA = "REPLY_MEDIA",
  MESSAGE_IMAGE = "MESSAGE_IMAGE",
  POST_IMAGE = "POST_IMAGE",
  REPLY_IMAGE = "REPLY_IMAGE",
}

export type SocketMessageType =
  | keyof typeof UploadType
  | "UNAUTHENTICATED"
  | "CONNECTION"
  | "MESSAGE"
  | "BROADCAST"
  | "DIRECT"
  | "USER_BUSY"
  | "USER_OFFLINE"
  | "NO_ANSWER"
  | "CALL_CANCELED"
  | "ANSWER_OFFER"
  | "CALL_OFFER"
  | "ONLINE"
  | "TYPING"
  | "SEEN_CONVERSATION";

export type TestObserver =
  | "FETCH"
  | "REFETCH"
  | "FETCH_MORE"
  | "FETCH_MORE_FINAL"
  | "SET_POST_COUNTER"
  | "HIDE_MODAL"
  | "AUTHENTICATION"
  | "WS_OPEN"
  | "UPDATE_AVATAR"
  | "UPDATE_BIO"
  | "NOTIFICATION_TOGGLE"
  | "FOLLOW_STATUS"
  | "FOLLOW_COUNT"
  | "GET_USER"
  | "FOLLOW_USER"
  | "UNFOLLOW_USER"
  | "LOG_OUT"
  | "GET_CONVERSATIONS-CACHE_UPDATE"
  | "GET_CONVERSATIONS-CACHE_ADD"
  | "FIND_USER"
  | "REACTIONS-CACHE_UPDATE"
  | "REACTIONS-CACHE_ADD"
  | "REACTIONS-CACHE_DELETE"
  | "REACTIONS-CACHE_WRITE"
  | "REMOVE_REACTION"
  | "ADD_REACTION"
  | "DELETE_MESSAGE"
  | "TYPING"
  | "SEND_MESSAGE"
  | "PEER_SIGNAL_EVENT"
  | "CALL_CANCELED"
  | "USER_BUSY"
  | "GET_POST"
  | "GET_POSTS"
  | "UNLIKE_POST"
  | "LIKE_POST"
  | "SEEN_CONVERSATION"
  | AuthRoute;
