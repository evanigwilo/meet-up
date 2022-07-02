// 👇 Express
import { Request, Response } from 'express';
// 👇 Apollo & Graphql
import { ResolverFn, withFilter } from 'graphql-subscriptions';
// 👇 Mongoose
import mongoose from 'mongoose';
// 👇 Websocket
import { WebSocketServer } from 'ws';
// 👇 Constants, Helpers & Types
import { reactions } from '../constants';
import { AuthType, Gender, MediaCategory, ResponseCode, UploadType } from './enum';

export type KeyValue<T = string> = {
  [key: string | number]: T;
};

export type UserInput = {
  name: string;
  username: string;
  password: string;
  gender: Gender;
  bio: string;
  email: string;
};

export type AuthInput = {
  auth: AuthType;
  username: string;
};

export type MessageInput = {
  to: string;
  body?: string;
  missed?: boolean;
  id?: string;
};

export type PostInput = {
  body: string;
  parent?: string;
  id?: string;
};

export type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn;

export type QueryMutation = Partial<
  Record<
    'Query' | 'Mutation',
    KeyValue<
      (
        parent: undefined,
        args: KeyValue &
          Pagination & { messageInput: MessageInput } & { postInput: PostInput } & { authInput: AuthInput } & {
            userInput: UserInput;
            toggle: boolean;
          } & { reaction: ReactionKeys },
        context: QueryMutationContext,
      ) => void
    >
  >
>;

export type Subscription = {
  Subscription: Record<
    string,
    {
      subscribe: ResolverFn | typeof withFilter /* | ReplaceReturnType<FilterFn, any> */;
    }
  >;
};

export type Pagination = {
  offset: number;
  limit: number;
};

export type QueryMutationContext = {
  req: Request;
  res: Response;
  wsServer: WebSocketServer;
};

export type SubscriptionContext = Partial<{
  user: Express.User;
  expires: number;
}>;

export type SocketMessage = {
  type: SocketMessageType;
  content?: unknown;
  from?: string;
  to?: string;
};

export type ReactionKeys = keyof typeof reactions;

export type WsAuth = Partial<{
  id: string;
  name: string;
  expires: number;
  type: 'WS_AUTH_TOKEN';
}>;

export type Conversations = {
  update: boolean;
  from: string;
  to: string;
  unseen: number;
};

export type Reacted = {
  reaction?: ReactionKeys;
  deleted: boolean;
  message: string;
  from: string;
  to: string;
  user: string;
};

type Metadata = {
  _id: mongoose.Types.ObjectId | false;
  userId: string;
  email: string;
  username: string;
  auth: string;
  category: Exclude<MediaCategory, MediaCategory.AVATAR>;
};

type MetadataProjection = Record<keyof Metadata, boolean>;

export type ImageSchema = {
  _id: mongoose.Types.ObjectId;
  filename: string;
  metadata: Metadata;
  image: {
    data: Buffer;
    contentType: string;
    size: string;
  };
};

export type ImageProjection = Partial<{
  filename: boolean;
  image: Partial<Record<keyof ImageSchema['image'], boolean>> | boolean;
  metadata: Partial<MetadataProjection> | boolean;
}>;

export type MediaSchema = {
  _id: mongoose.Types.ObjectId;
  filename: string;
  contentType: string;
  metadata: Metadata;
  length: number;
};

export type MediaProjection = Partial<{
  filename: boolean;
  contentType: boolean;
  length: boolean;
  metadata: Partial<MetadataProjection> | boolean;
}>;

export type SocketMessageType =
  | UploadType
  | ResponseCode.UNAUTHENTICATED
  | 'CONNECTION'
  | 'MESSAGE'
  | 'BROADCAST'
  | 'DIRECT'
  | 'USER_BUSY'
  | 'USER_OFFLINE'
  | 'NO_ANSWER'
  | 'CALL_CANCELED'
  | 'ANSWER_OFFER'
  | 'CALL_OFFER'
  | 'ONLINE'
  | 'TYPING'
  | 'SEEN_CONVERSATION';
