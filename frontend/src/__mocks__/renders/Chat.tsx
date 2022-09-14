// 👇 React Testing
import { screen, fireEvent } from "@testing-library/react";
// 👇 Renders
import { renderConversationMessages } from "../../__mocks__/renders/Conversations";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { MessageInput, MessageType } from "../../utils/types";
import { CallStatus } from "../../__mocks__/utils/types";
import { reactions } from "../../utils/constants";
import {
  disabledElement,
  enabledElement,
  followCount,
} from "../../__mocks__/utils/constants";
import {
  findTextContent,
  wait,
  findErrorText,
  findMediaElement,
  testObserverCount,
  createUserSub,
  generateMessages,
  testErrorExtensions,
} from "../../__mocks__/utils/helpers";

export const testMessageElement = async (
  message: MessageType,
  sender?: boolean
) => {
  const testBody = !message.missed && !message.deleted && message.body;
  // 👇 body
  if (testBody) {
    const body = screen.getByText(findTextContent(message.body!));
    expect(body).toBeVisible();
  }
  // 👇 media
  if (testBody && message.media) {
    const tag = helpers.isMimeType("image", message.media) ? "img" : "source";
    let mediaSource = screen.getByText(
      findMediaElement(
        helpers.mediaUrl("message", message.id, message.media),
        tag
      )
    );
    let mediaElement =
      tag === "source" ? mediaSource.parentElement! : mediaSource;
    expect(mediaElement).toBeInTheDocument();
    expect(mediaElement).not.toBeVisible();
    // 👇 simulate load event if image or playable media
    if (tag === "source") {
      fireEvent.loadedMetadata(mediaElement);
    } else {
      fireEvent.load(mediaElement);
    }
    // 👇 check media visibility
    await wait(() => {
      expect(mediaElement).toBeVisible();
    });
    // 👇 styling based of left or right based on sender
    expect(mediaElement.parentElement).toHaveStyle({
      "text-align": sender ? "right" : "left",
    });
  }
  // 👇 reaction
  if (message.reactions) {
    const reaction = message.reactions.reduce<string>(
      (output, { reaction }) => {
        output += reactions[reaction];
        return output;
      },
      ""
    );
    const reactionElement = screen.queryByTestId(
      `message-reaction-${message.id}`
    );
    expect(reactionElement?.textContent).toEqual(
      reaction + message.reactions.length
    );
  }
  // 👇 message options
  const reactOption = screen.queryByTestId(
    `message-options-react-${message.id}`
  );
  const deleteOption = screen.queryByTestId(
    `message-options-delete-${message.id}`
  );
  expect(reactOption || deleteOption).toBeNull();
};

const testMessages = async (
  total: number,
  pages: number,
  messages: ReturnType<typeof generateMessages>,
  sender?: boolean
) => {
  // 👇 check if error was rendered
  const firstPage = messages[0].result;
  if ("errors" in firstPage) {
    // 👇 error text display should exist
    testErrorExtensions(firstPage);
    return;
  }

  const count = total * pages;
  const firstMessage = firstPage.data.getMessages[0];
  const formatDate = helpers.formatTime(firstMessage.createdDate);
  const testBody = !firstMessage.missed && !firstMessage.deleted;
  if (testBody) {
    // 👇 check messages elements
    const options = screen.queryAllByTestId(/^message-options-/);
    expect(options).toHaveLength(count);
    const container = screen.queryAllByTestId(/^message-container-/);
    expect(container).toHaveLength(count);
    const body = screen.queryAllByTestId(/^message-body-/);
    expect(body).toHaveLength(count);
    body.forEach((element) => {
      // 👇 styling based of left or right based on sender
      expect(element).toHaveStyle({
        "flex-direction": sender ? "row-reverse" : "row",
      });
    });
    // 👇 created date
    const createdDate = screen.getAllByText(findTextContent(formatDate));
    expect(createdDate).toHaveLength(count);
    // 👇 reactions
    if (firstMessage.reactions) {
      const reaction = screen.queryAllByTestId(/^message-reaction-/);
      expect(reaction).toHaveLength(count);
      reaction.forEach((element) => {
        // 👇 styling based of left or right based on sender
        expect(element).toHaveStyle({
          "flex-direction": sender ? "row-reverse" : "row",
        });
      });
    }
  }

  if (firstMessage.deleted) {
    const body = screen.getAllByText(
      findTextContent("⊘ This message was deleted.")
    );
    expect(body).toHaveLength(count);
    body.forEach((element) => {
      // 👇 styling based of left or right based on sender
      expect(element).toHaveStyle({
        [`margin-${sender ? "left" : "right"}`]: "auto",
      });
    });
  } else if (firstMessage.missed) {
    const body = screen.queryAllByTestId(/^message-missed-/);
    expect(body).toHaveLength(count);
    body.forEach((element) => {
      // 👇 styling based of left or right based on sender
      expect(element).toHaveStyle({
        "align-items": "center",
        "justify-content": "center",
      });
      expect(element.textContent).toContain("✆");
      expect(element.textContent).toContain(
        `Missed video call at ${formatDate}`
      );
    });
  }

  // 👇 test each message element
  for (const pages of messages) {
    const page = pages.result as {
      data: {
        getMessages: MessageType[];
      };
    };
    for (const message of page.data.getMessages) {
      await testMessageElement(message, sender);
    }
  }
};

export default async (
  mockUseNavigate: jest.Mock,
  args?: Partial<{
    call: {
      status: CallStatus;
    };
    sender: boolean;
    body: boolean;
    deleted: boolean;
    missed: boolean;
    media: boolean;
    error: string;
    reaction: boolean;
    modifyReaction: boolean;
    deleteMessage: boolean;
    chatSubscriptionReacted: "add" | "update" | "delete";
    sendMessage: Partial<MessageInput> & { media?: string };
  }>
) => {
  const user = createUserSub();
  const sender = args?.sender !== undefined ? args.sender : true;

  const total = 3;
  const pages = 2;

  const { firstConversation, other, getMessages, spyTestObserver } =
    await renderConversationMessages(mockUseNavigate, sender, {
      total: 1,
      subscriptionCacheUpdate: false,
      user,
      messages: {
        total,
        pages,
        error: args?.error,
        chatSubscriptionReacted: args?.chatSubscriptionReacted || "update",
        reaction: args?.reaction,
        modifyReaction: args?.modifyReaction,
        deleteMessage: args?.deleteMessage,
        sendMessage: args?.sendMessage,
      },
      call: args?.call,
      deleted: args?.deleted,
      media: args?.media ? "audio/mpeg" : undefined,
      missed: args?.missed,
    });

  const firstPage = getMessages[0].result;
  // 👇 check if error was rendered
  const messagesError = "errors" in firstPage;
  const conversation = screen.getByTestId(
    `conversations-${firstConversation.id}`
  );
  // 👇 trigger clicking 'conversation' to open chat
  fireEvent.click(conversation);
  await wait(() => {
    const chatContainer = screen.getByTestId("chat-container");
    expect(chatContainer).toHaveStyle(
      messagesError
        ? {
            "pointer-events": "none",
          }
        : enabledElement
    );
    // 👇 chat navigation icons
    const conversationBack = screen.getByTestId("back-conversation");
    expect(conversationBack).toBeVisible();
    const startVideoCall = screen.getByTestId("start-video-call");
    expect(startVideoCall).toBeVisible();
  });

  const videoCall = args?.call;
  if (messagesError) {
    // 👇 error text display should exist
    const errorElement = screen.getByText(
      findErrorText(firstPage.errors[0].extensions.getMessages as string)
    );
    expect(errorElement).toBeVisible();
  } else if (!videoCall) {
    await wait(() => {
      // 👇 get the other user name and profile in chat header and userInfo after all messages are loaded
      const name = screen.getAllByText(findTextContent(other.name));
      const profile = screen.getAllByText(
        findMediaElement(helpers.avatarUrl(other.id))
      );
      expect(name).toHaveLength(2);
      expect(profile).toHaveLength(2);
      // 👇 get the other user name in chat header and user info after all messages are loaded
      const username = screen.getByText(findTextContent(`@${other.username}`));
      expect(username).toBeVisible();
      // 👇 get other user last seen
      const last = screen.getByText(findTextContent("ONLINE"));
      expect(last).toBeVisible();
      // 👇 get follow counts
      const followCounts = screen.getByText(
        findTextContent(
          `${followCount.following}Following${followCount.followers}Followers`,
          "div"
        )
      );
      expect(followCounts).toBeVisible();
      // 👇 get other user joined date
      const joined = screen.getByTestId("chat-joined-date");
      expect(joined.textContent).toContain("🗓");
      expect(joined.textContent).toContain("Joined");
      expect(joined.textContent).toContain(
        new Date(Number(other.createdDate)).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      );
    });

    await testMessages(total, pages, getMessages, args?.sender);

    // 👇 chat date scrolling tip
    const firstMessage = firstPage.data.getMessages[0];
    const chatDate = screen.getByTestId("chat-date");
    // 👇 chat date should be hidden
    expect(chatDate).toHaveStyle(disabledElement);
    expect(chatDate).toHaveTextContent(
      new Date(Number(firstMessage.createdDate)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );

    jest.useFakeTimers();
    const chatContainer = screen.getByTestId("chat-container");
    fireEvent.scroll(chatContainer);
    // 👇 chat date should be visible
    await wait(() => {
      expect(chatDate).toHaveStyle(enabledElement);
    });
    // 👇 advance timer to hide chat date
    jest.advanceTimersByTime(helpers.secsToMs(3));
    expect(chatDate).toHaveStyle(disabledElement);
    jest.useRealTimers();
  }

  await wait(() => {
    const chatAttachment = screen.getByTestId("attachment-chat");
    // 👇 message attachment should be visible
    expect(chatAttachment).toBeVisible();
    // 👇 message input controller should be active in no error
    expect(chatAttachment).toHaveStyle(
      messagesError
        ? {
            "pointer-events": "none",
          }
        : enabledElement
    );
    // 👇 no profile avatar
    const messageAvatar = chatAttachment.querySelector("img");
    expect(messageAvatar).toBeNull();

    // 👇 check message text input
    const messageInput = screen.getByPlaceholderText("Start a new message");
    expect(messageInput).toBeVisible();
    expect(messageInput).toHaveValue("");
    // 👇 check message media attachment icon
    const media = screen.getByTestId("attachment-chat-media-change");
    expect(media).toBeVisible();
  });

  // 👇 fetch message calls
  const calls = spyTestObserver.mock.calls;
  const expectFetch = expect(testObserverCount(calls, "FETCH"));
  const expectFetchMore = expect(testObserverCount(calls, "FETCH_MORE"));

  if (videoCall) {
    // 👇 no fetching if video call
    expectFetch.toEqual(0);
    expectFetchMore.toEqual(0);
  } else {
    expectFetch.toEqual(1);
    if (messagesError) {
      // 👇 no fetching more if error
      expectFetchMore.toEqual(0);
    } else {
      if (firstConversation.to.id === user.id && firstConversation.seen) {
        // 👇 socket sent 'seen conversation'
        expect(testObserverCount(calls, "SEEN_CONVERSATION"));
      }
      expectFetchMore.toBeGreaterThan(0);
    }
  }

  return { spyTestObserver, getMessages, user, other };
};
