// 👇 Apollo & Graphql
import { MockedResponse } from "@apollo/client/testing";
// 👇 Constants, Helpers & Types
import { SocketMessageType } from "../../utils/types";

export type Mocks =
  | MockedResponse<Record<string, any>, Record<string, any>>[]
  | undefined;

export type CallStatus = Extract<
  SocketMessageType,
  | "UNAUTHENTICATED"
  | "USER_BUSY"
  | "USER_OFFLINE"
  | "NO_ANSWER"
  | "ANSWER_OFFER"
  | "CALL_OFFER"
>;

export type Tag = "source" | "img";
