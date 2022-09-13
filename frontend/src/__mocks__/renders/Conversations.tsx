// 👇 React Testing
import { fireEvent, screen } from "@testing-library/react";
// 👇 Services
import dayjs from "../../services/dayjs";
// 👇 Renders
import renderHeader from "./Header";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { followCount, nbsp, testTime, uploadId } from "../utils/constants";
import { CallStatus, Mocks } from "../utils/types";
import {
  AuthInput,
  ConversationType,
  MessageInput,
  ReactedType,
  UserSub,
  UserType,
} from "../../utils/types";
import {
  createMessage,
  createUserSub,
  createUserType,
  findMediaElement,
  findTextContent,
  generateConversations,
  generateMessages,
  mockMutations,
  mockQueries,
  mockSubscriptions,
  testErrorExtensions,
  testObserverCount,
  wait,
} from "../utils/helpers";

// 👇 check user conversations
export const testConversations = (
  total: number,
  pages: number,
  conversations: ReturnType<typeof generateConversations>,
  args?: Partial<{
    body: boolean;
    deleted: boolean;
    missed: boolean;
    media: string;
    sender: boolean;
  }>
) => {
  // 👇 check if error was rendered
  const firstPage = conversations[0].result;
  if ("errors" in firstPage) {
    // 👇 error text display should exist
    testErrorExtensions(firstPage);
    return;
  }

  const count = total * pages;
  // 👇 check user conversations
  const queryConversations = screen.getAllByTestId(/^conversations-/);
  expect(queryConversations).toHaveLength(count);

  const firstConversationCreatedDate =
    firstPage.data.getConversations[0].message.createdDate;
  if (args?.deleted) {
    const body = screen.getAllByText(
      findTextContent(
        args?.sender
          ? "⊘ You deleted this message."
          : "⊘ This message was deleted."
      )
    );
    expect(body).toHaveLength(count);
  } else if (args?.missed) {
    const body = screen.getAllByTestId(/^body-conversations-/);
    expect(body).toHaveLength(count);

    // 👇 messages with call should have call icon
    const call = !args?.sender && !args?.deleted && args?.missed;
    body.forEach((element) =>
      expect(element.textContent).toEqual(
        call
          ? `✆${nbsp}Missed video call.`
          : `You called at ${helpers.formatTime(firstConversationCreatedDate)}`
      )
    );
  } else if (args?.media) {
    const body = screen.getAllByTestId(/^body-conversations-/);
    expect(body).toHaveLength(count);
    // 👇 messages with media should have media icon
    const media = helpers.isMimeType("image", args.media)
      ? "Image"
      : helpers.isMimeType("video", args.media)
      ? "Video"
      : "Audio";
    body.forEach((element) =>
      expect(element.textContent).toEqual(`${nbsp}${media}`)
    );
  }
  // 👇 created date
  const formatDate = dayjs(Number(firstConversationCreatedDate)).fromNow();
  const createdDate = screen.getAllByText(findTextContent(formatDate));
  expect(createdDate).toHaveLength(count);

  // 👇 test each conversation element
  conversations.forEach((pages) => {
    const page = pages.result as {
      data: {
        getConversations: ConversationType[];
      };
    };
    page.data.getConversations.forEach((conversation) => {
      // 👇 body
      if (args?.body) {
        const body = screen.getByText(
          findTextContent(conversation.message.body!)
        );
        expect(body).toBeVisible();
      }
      const other = args?.sender ? conversation.to : conversation.from;
      // 👇 name
      const name = screen.getByText(findTextContent(other.name!));
      expect(name).toBeVisible();
      // 👇 profile
      const profile = screen.getByText(
        findMediaElement(helpers.avatarUrl(other.id))
      );
      expect(profile).toBeVisible();
    });
  });
};

export const renderConversations = async (
  mockUseNavigate: jest.Mock,
  pages: number,
  conversations: ReturnType<typeof generateConversations>,
  args?: Partial<{
    authUser: UserType;
    mocks: Mocks;
    subscriptionCacheUpdate: boolean;
    messenger: boolean;
    chatSubscriptionReacted: "add" | "update" | "delete";
    sender: boolean;
  }>
) => {
  const mocks: Mocks = args?.mocks || [];
  const authUser = args?.authUser;
  const subscriptionCacheUpdate = args?.subscriptionCacheUpdate;
  const messenger = args?.messenger || false;

  const firstPage = conversations[0].result;
  // 👇 check if error should be rendered
  const conversationError = "errors" in firstPage;

  mocks.push(...conversations);
  if (!conversationError) {
    // 👇 subscriptions runs on first render which modifies cache, resulting in fetching again
    mocks.push(...conversations);
  }

  // 👇 subscriptions for conversations in that order
  if (!conversationError && subscriptionCacheUpdate) {
    const { message, to, from } = firstPage.data.getConversations[0];
    // 👇 defining mocked subscription to update conversation
    mocks.push(
      mockSubscriptions.message({
        ...message,
        from,
        to,
        reactions: null,
        type: "DELETED_MESSAGE",
      })
    );
  } else {
    // 👇 defining mocked subscription to add to conversation
    mocks.push(mockSubscriptions.message(createMessage("NEW_MESSAGE")));
  }

  // 👇 subscriptions for chat in that order
  const chatSubscriptionReacted = args?.chatSubscriptionReacted;
  if (!conversationError && chatSubscriptionReacted) {
    const { message, to, from } = firstPage.data.getConversations[0];
    const reacted: ReactedType = {
      deleted: chatSubscriptionReacted === "delete",
      user: chatSubscriptionReacted === "add" ? helpers.uniqueId() : from.id!,
      reaction: "like",
      message: message.id,
      from: from.id!,
      to: to.id!,
    };
    // 👇 defining mocked subscription for added, deleted or updated reaction
    mocks.push(mockSubscriptions.reacted(reacted));

    if (subscriptionCacheUpdate) {
      // 👇 defining mocked subscription for 'DELETED_MESSAGE' to update chat
      mocks.push(mockSubscriptions.message(createMessage("DELETED_MESSAGE")));
    } else {
      // 👇 defining mocked subscription for 'NEW_MESSAGE' to add to chat
      mocks.push(
        mockSubscriptions.message({
          ...message,
          // 👇 check to trigger cache update in chat
          from: args?.sender ? to : from,
          to,
          reactions: [
            {
              reaction: reacted.reaction,
              user: from,
              message,
              id: helpers.uniqueId(),
              createdDate: testTime.toString(),
            },
          ],
          type: "NEW_MESSAGE",
        })
      );
    }
  }

  // 👇 clean up a mock's usage data between assertions
  mockUseNavigate.mockClear();

  const { spyTestObserver } = await renderHeader(mocks, [true], {
    authUser,
    messenger,
    conversationError,
  });

  if (!messenger) {
    // 👇 messages icon
    const messages = screen.getByTestId("messages");
    // 👇 trigger show conversations
    fireEvent.click(messages);
  }

  await wait(() => {
    // 👇 finished pagination
    const finished = screen.queryByText(findTextContent("Finished."));
    if (conversationError) {
      expect(finished).toBeNull();
    } else {
      expect(finished).toBeVisible();
    }
  });

  // 👇 conversations tab
  const conversationsTab = screen.getByTestId("tab-conversations");
  const chats = screen.getByText(findTextContent("Chats"));
  const close = screen.getByTestId("close-conversations");
  expect(conversationsTab).toBeVisible();
  expect(chats).toBeVisible();
  expect(close).toBeVisible();
  // 👇 find user search bar
  const findUser = screen.getByPlaceholderText("Find User");
  expect(findUser).toBeVisible();
  expect(findUser).toHaveValue("");

  // 👇 NOTE: method calls with subscriptions returns inconsistent 'fetch more' calls
  const calls = spyTestObserver.mock.calls;
  const cacheCall = subscriptionCacheUpdate
    ? "GET_CONVERSATIONS-CACHE_UPDATE"
    : "GET_CONVERSATIONS-CACHE_ADD";

  if (messenger) {
    // 👇 no navigating to messenger
    expect(mockUseNavigate).toHaveBeenCalledTimes(0);
    // 👇 fetch call is already checked in header render
    expect(testObserverCount(calls, "FETCH")).toEqual(0);
  } else {
    // 👇 should try navigating to messenger
    expect(mockUseNavigate).toHaveBeenCalledTimes(1);
    expect(mockUseNavigate).toHaveBeenCalledWith("/messenger");
    // 👇 fetch posts calls
    expect(testObserverCount(calls, "FETCH")).toEqual(1);
  }

  if (conversationError) {
    expect(testObserverCount(calls, "FETCH_MORE")).toEqual(0);
    // 👇 no cache modification if error
    expect(testObserverCount(calls, cacheCall)).toEqual(0);
  } else {
    expect(testObserverCount(calls, "FETCH_MORE")).toBeGreaterThanOrEqual(
      pages
    );
    expect(testObserverCount(calls, cacheCall)).toEqual(1);
  }
  // 👇 clean up a mock's usage data between assertions
  spyTestObserver.mockClear();

  return { spyTestObserver };
};

export const renderConversationMessages = async (
  mockUseNavigate: jest.Mock,
  sender: boolean,
  args?: Partial<{
    deleted: boolean;
    missed: boolean;
    media: string;
    total: number;
    pages: number;
    user: UserSub;
    subscriptionCacheUpdate: boolean;
    messages: {
      total: number;
      pages: number;
      chatSubscriptionReacted: "add" | "update" | "delete";
      error?: string;
      reaction?: boolean;
      mocks?: Mocks;
      modifyReaction?: boolean;
      deleteMessage?: boolean;
      sendMessage?: Partial<MessageInput> & { media?: string };
    };
    call: {
      status: CallStatus;
    };
  }>
) => {
  // 👇
  /* 
    pages should be be greater than 1 to prevent 'children with the same key' error 
    with message subscription mock in conversation
  */
  const pages = args?.pages || 2;
  const total = args?.total || 3;
  const user = args?.user || createUserSub();
  const authUser = createUserType({
    sub: user,
  });
  const attr = {
    deleted: Boolean(args?.deleted),
    missed: Boolean(args?.missed),
    media: args?.media,
  };
  const options = {
    ...(sender
      ? {
          from: user,
        }
      : {
          to: user,
        }),
    ...attr,
  };
  const getConversations = generateConversations(total, pages, options);

  const messages = args?.messages;
  const call = args?.call;
  const mocks: Mocks = messages?.mocks || [];
  const firstPage = getConversations[0].result as {
    data: {
      getConversations: ConversationType[];
    };
  };
  const firstConversation = firstPage.data.getConversations[0];
  const from = firstConversation.from as UserSub;
  const to = firstConversation.to as UserSub;
  const other = sender ? to : from;

  let getMessages: ReturnType<typeof generateMessages> = [];
  // 👇 generate mock response for messages
  if (messages) {
    getMessages = generateMessages(messages.total, messages.pages, other.id, {
      from,
      to,
      reaction: messages.reaction,
      error: messages.error,
      ...attr,
    });
    mocks.push(...getMessages);
    const authInput: AuthInput = {
      auth: other.auth,
      username: other.username,
    };
    // 👇 generate mock response for other user follower count
    mocks.push(mockQueries.getFollowCount(authInput, followCount));

    const firstPage = getMessages[0].result;
    if ("data" in firstPage) {
      const id = firstPage.data.getMessages[0].id;
      // 👇 generate mock response for message reactions
      if (messages.modifyReaction) {
        mocks.push(mockMutations.addReactionMessage(id, "like", user));
        mocks.push(mockMutations.removeReactionMessage(id));
      }
      // 👇 generate mock response for deleting a message
      if (messages.deleteMessage) {
        mocks.push(mockMutations.deleteMessage(id));
      }
      const sendMessage = messages.sendMessage;
      // 👇 generate mock response for sending a message
      if (sendMessage) {
        mocks.push(
          mockMutations.sendMessage(
            {
              body: sendMessage.body!,
              to: other.id,
              id: uploadId,
            },
            sendMessage.media
          )
        );
      }
    }
  }
  // 👇 call status to return different socket message when a 'call offer' is sent
  if (call) {
    authUser.token = call.status;
  }
  const cacheUpdate = args?.subscriptionCacheUpdate;
  const { spyTestObserver } = await renderConversations(
    mockUseNavigate,
    pages,
    getConversations,
    {
      authUser,
      subscriptionCacheUpdate: cacheUpdate !== undefined ? cacheUpdate : true,
      mocks,
      chatSubscriptionReacted: messages?.chatSubscriptionReacted,
      sender,
    }
  );

  await wait(() => {
    testConversations(total, pages, getConversations, {
      sender,
      body: !(attr.deleted || attr.media || attr.missed),
      ...attr,
    });
  });

  return {
    // 👇 the first conversation info
    firstConversation,
    other,
    getMessages,
    spyTestObserver,
  };
};
