// 👇 React Testing
import { cleanup, screen, fireEvent, act } from "@testing-library/react";
// 👇 Services
import axios from "../../services/axios";
// 👇 Renders
import renderChats, { testMessageElement } from "../../__mocks__/renders/Chat";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { reactions } from "../../utils/constants";
import { MessageType, TestObserver } from "../../utils/types";
import { uploadId } from "../../__mocks__/utils/constants";
import {
  wait,
  testObserverCount,
  createMessage,
  typeInput,
  sendInput,
  createTransitionendEvent,
  mockObjectURL,
  mockAvatarUrl,
  loadFileForSuccessfulUpload,
  testNoRemoveOrMediaElement,
  loadFileForFailedUpload,
  testFailedUpload,
  mockMatchMedia,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

const reactToMessage = async (message: MessageType, sender: boolean) => {
  // 👇 message options
  const options = screen.getByTestId(`message-options-${message.id}`);
  let reactOption = screen.queryByTestId(`message-options-react-${message.id}`);
  let deleteOption = screen.queryByTestId(
    `message-options-delete-${message.id}`
  );
  // 👇 message options should not exist
  expect(reactOption || deleteOption).toBeNull();
  // 👇 trigger clicking message options
  fireEvent.click(options);
  await wait(() => {
    reactOption = screen.queryByTestId(`message-options-react-${message.id}`);
    deleteOption = screen.queryByTestId(`message-options-delete-${message.id}`);
    // 👇 message options should be visible
    expect(reactOption).toBeVisible();
    if (sender) {
      expect(deleteOption).toBeVisible();
    } else {
      expect(deleteOption).toBeNull();
    }
  });

  // 👇 no visible reactions selector
  for (const reaction in reactions) {
    expect(screen.queryByTestId(`reaction-${reaction}`)).toBeNull();
  }
  // 👇 trigger clicking react option
  fireEvent.click(reactOption!);
  const selections = screen.getByTestId(
    `message-options-selections-${message.id}`
  );
  // 👇 trigger 'transitionEnd' event to view reactions selector
  fireEvent.transitionEnd(selections);
  await wait(async () => {
    // 👇 reactions selector should be visible
    for (const reaction in reactions) {
      expect(screen.getByTestId(`reaction-${reaction}`)).toBeVisible();
    }
  });
  let likeReaction = screen.getByTestId("reaction-like");
  // 👇 trigger clicking like reaction to like
  fireEvent.click(likeReaction);
  await wait(async () => {
    // 👇 reactions selector container should have opacity of 0
    likeReaction = screen.getByTestId("reaction-like");
    expect(likeReaction.parentElement!).toHaveStyle({ opacity: 0 });
  });
  // 👇 mock and dispatch 'transitionend' event
  await act(async () => {
    likeReaction = screen.getByTestId("reaction-like");
    likeReaction.parentElement!.dispatchEvent(createTransitionendEvent());
  });
  await wait(() => {
    // 👇 no visible reactions selector after selection
    for (const reaction in reactions) {
      expect(screen.queryByTestId(`reaction-${reaction}`)).toBeNull();
    }
  });
};

const deleteMessage = async (message: MessageType) => {
  // 👇 message options
  let options = screen.queryByTestId(`message-options-${message.id}`);
  let deleteOption = screen.queryByTestId(
    `message-options-delete-${message.id}`
  );
  // 👇 delete option should not exist
  expect(deleteOption).toBeNull();
  // 👇 trigger clicking message options
  fireEvent.click(options!);
  await wait(() => {
    // 👇 delete option should be visible
    deleteOption = screen.getByTestId(`message-options-delete-${message.id}`);
    expect(deleteOption).toBeVisible();
  });

  // 👇 trigger clicking react option
  fireEvent.click(deleteOption!);
  const selections = screen.getByTestId(
    `message-options-selections-${message.id}`
  );
  // 👇 trigger 'transitionEnd' event to hide message option
  fireEvent.transitionEnd(selections);
  await wait(async () => {
    // 👇 delete option should not exist
    deleteOption = screen.queryByTestId(`message-options-delete-${message.id}`);
    expect(deleteOption).toBeNull();
  });
};

const typeMessageInput = async (
  message: MessageType,
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>
) => {
  // 👇 the message to be created should not be in document
  const findMessage = screen.queryByTestId(`message-container-${message.id}`);
  expect(findMessage).toBeNull();

  await typeInput("Start a new message", message);

  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 sending typing status calls
  expect(testObserverCount(calls, "TYPING")).toBeGreaterThan(0);
};

const sendMessage = async (
  message: MessageType | string,
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>,
  sender?: boolean
) => {
  await sendInput("Start a new message", message, async () => {
    message = message as MessageType;
    // 👇 check if message element matches the created message
    await testMessageElement(message, sender);
    // 👇 test message date
    const dateElement = screen.getByTestId(`message-date-${uploadId}`);
    expect(dateElement).toHaveTextContent(
      message.body === "__error__"
        ? "🚫 Message not sent"
        : helpers.formatTime(message.createdDate)
    );
  });
  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 sending typing status calls
  expect(testObserverCount(calls, "SEND_MESSAGE")).toEqual(1);
};

describe("Chat", () => {
  beforeAll(() => {
    // 👇 mock object URL representing the specified File object or Blob object
    mockObjectURL();
    // 👇 mock heights of document property to trigger initial load of messages
    ["scrollHeight", "clientHeight"].forEach((property) =>
      Object.defineProperty(HTMLDivElement.prototype, property, {
        configurable: true,
        value: 50,
      })
    );
    ["scrollTo", "scrollIntoView"].forEach((property) =>
      Object.defineProperty(HTMLDivElement.prototype, property, {
        configurable: true,
        value: jest.fn(),
      })
    );
    mockMatchMedia();
    // mock avatar url for consistent value in DOM testing
    jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  });

  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should send a message", async () => {
    const message = createMessage("NEW_MESSAGE");
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      sendMessage: {
        body: message.body!,
      },
    });

    // 👇 type in message input
    await typeMessageInput(message, spyTestObserver);
    // 👇 send the message
    await sendMessage(message, spyTestObserver, true);
  });

  it("should send a failed message", async () => {
    const body = "__error__";
    const message = createMessage("NEW_MESSAGE", {
      body,
    });
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      sendMessage: {
        body,
      },
    });

    // 👇 type in message input
    await typeMessageInput(message, spyTestObserver);
    // 👇 send the message
    await sendMessage(message, spyTestObserver, true);
  });

  it("should send a message with media", async () => {
    const message = createMessage("NEW_MESSAGE");
    const type = "audio/mpeg";
    const name = "file.mp3";
    const tag = "source";
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      sendMessage: {
        body: message.body!,
        media: type,
      },
    });

    const spyAxiosPost = jest.spyOn(axios, "post");
    // 👇 type in message input
    await typeMessageInput(message, spyTestObserver);

    await loadFileForSuccessfulUpload({
      attachmentId: "chat",
      name,
      tag,
      spyAxiosPost,
      type,
    });

    // 👇 send the message
    await sendMessage(message, spyTestObserver, true);
    // 👇 media & remove element should not exist
    testNoRemoveOrMediaElement(tag);

    // 👇 TEST MESSAGE WITH MEDIA EXCEEDING MAXIMUM UPLOAD LIMIT
    const error = await loadFileForFailedUpload({
      name,
      tag,
      spyAxiosPost,
      type,
    });

    // 👇 send the message with upload limit error
    await sendMessage(error, spyTestObserver);
    await testFailedUpload("chat", tag);
  });

  it("should not render chats when user session is expired", async () => {
    await renderChats(mockUseNavigate, {
      error: "User not authenticated.",
    });
  });

  it("should render messages with reactions subscription adding to cache", async () => {
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      chatSubscriptionReacted: "add",
    });
    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 cache calls
    expect(testObserverCount(calls, "REACTIONS-CACHE_ADD")).toEqual(1);
    expect(testObserverCount(calls, "REACTIONS-CACHE_WRITE")).toEqual(1);
  });

  it("should render messages with reactions subscription updating the cache", async () => {
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      chatSubscriptionReacted: "update",
    });
    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 cache calls, no update cache call as subscription checks cache on initial render which is empty
    expect(testObserverCount(calls, "REACTIONS-CACHE_UPDATE")).toEqual(0);
    expect(testObserverCount(calls, "REACTIONS-CACHE_WRITE")).toEqual(1);
  });

  it("should render messages with reactions subscription deleting from cache", async () => {
    const { spyTestObserver } = await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      chatSubscriptionReacted: "delete",
    });
    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 cache calls
    expect(testObserverCount(calls, "REACTIONS-CACHE_DELETE")).toEqual(1);
    expect(testObserverCount(calls, "REACTIONS-CACHE_WRITE")).toEqual(1);
  });

  it("should render messages as sender with reactions", async () => {
    await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
      reaction: true,
    });
  });

  it("should render messages as sender with only text body", async () => {
    await renderChats(mockUseNavigate, {
      sender: true,
      body: true,
    });
  });

  it("should render messages as sender with media", async () => {
    await renderChats(mockUseNavigate, {
      sender: true,
      media: true,
      body: true,
    });
  });

  it("should render deleted messages as sender", async () => {
    await renderChats(mockUseNavigate, {
      sender: true,
      deleted: true,
      body: false,
    });
  });

  it("should render missed video call messages as sender", async () => {
    await renderChats(mockUseNavigate, {
      sender: true,
      missed: true,
      body: false,
    });
  });

  it("should render messages as receiver with reactions", async () => {
    await renderChats(mockUseNavigate, {
      sender: false,
      body: true,
      reaction: true,
    });
  });

  it("should render messages as receiver with only text body", async () => {
    await renderChats(mockUseNavigate, {
      sender: false,
      body: true,
    });
  });

  it("should render messages as receiver with media", async () => {
    await renderChats(mockUseNavigate, {
      sender: false,
      media: true,
      body: true,
    });
  });

  it("should render deleted messages as receiver", async () => {
    await renderChats(mockUseNavigate, {
      sender: false,
      deleted: true,
      body: false,
    });
  });

  it("should render missed video call messages as receiver", async () => {
    await renderChats(mockUseNavigate, {
      sender: false,
      missed: true,
      body: false,
    });
  });

  it("should react to a message as sender", async () => {
    const { getMessages, spyTestObserver } = await renderChats(
      mockUseNavigate,
      {
        sender: true,
        body: true,
        modifyReaction: true,
      }
    );

    const firstPage = getMessages[0].result;
    // 👇 return if error response
    if ("errors" in firstPage) {
      return;
    }

    const firstMessage = firstPage.data.getMessages[0];
    // 👇 like message
    await reactToMessage(firstMessage, true);
    // 👇 unlike message
    await reactToMessage(firstMessage, true);

    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 reaction mutation calls
    expect(testObserverCount(calls, "ADD_REACTION")).toEqual(1);
    expect(testObserverCount(calls, "REMOVE_REACTION")).toEqual(1);
  });

  it("should react to a message as receiver", async () => {
    const { getMessages, spyTestObserver } = await renderChats(
      mockUseNavigate,
      {
        sender: false,
        body: true,
        modifyReaction: true,
      }
    );

    const firstPage = getMessages[0].result;
    // 👇 return if error response
    if ("errors" in firstPage) {
      return;
    }

    const firstMessage = firstPage.data.getMessages[0];
    // 👇 like message
    await reactToMessage(firstMessage, false);
    // 👇 unlike message
    await reactToMessage(firstMessage, false);

    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 reaction mutation calls
    expect(testObserverCount(calls, "ADD_REACTION")).toEqual(1);
    expect(testObserverCount(calls, "REMOVE_REACTION")).toEqual(1);
  });

  it("should delete a message", async () => {
    const { getMessages, spyTestObserver } = await renderChats(
      mockUseNavigate,
      {
        sender: true,
        body: true,
        deleteMessage: true,
      }
    );

    const firstPage = getMessages[0].result;
    // 👇 return if error response
    if ("errors" in firstPage) {
      return;
    }

    const firstMessage = firstPage.data.getMessages[0];
    // 👇 delete message
    await deleteMessage(firstMessage);

    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 delete mutation calls
    expect(testObserverCount(calls, "DELETE_MESSAGE")).toEqual(1);
  });
});
