// 👇 React Testing
import { cleanup, screen, fireEvent } from "@testing-library/react";
// 👇 Renders
import {
  renderConversationMessages,
  renderConversations,
} from "../../__mocks__/renders/Conversations";
// 👇 Constants, Helpers & Types
import { testHandles, usersFound } from "../../__mocks__/utils/constants";
import {
  wait,
  createUserType,
  generateConversations,
  generateFindUsers,
  testHandleSearch,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

describe("Conversation", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render messages conversations by sender with message subscription adding to cache", async () => {
    await renderConversationMessages(mockUseNavigate, true, {
      subscriptionCacheUpdate: false,
    });
  });

  it("should render messages conversations by sender with message subscription updating cache", async () => {
    await renderConversationMessages(mockUseNavigate, true);
  });

  it("should render conversations of messages with media by sender", async () => {
    await renderConversationMessages(mockUseNavigate, true, {
      media: "image/png",
    });
  });

  it("should render conversations of deleted messages by sender", async () => {
    await renderConversationMessages(mockUseNavigate, true, {
      deleted: true,
    });
  });

  it("should render conversations of missed call messages by sender", async () => {
    await renderConversationMessages(mockUseNavigate, true, {
      missed: true,
    });
  });

  it("should render messages conversations by receiver with message subscription updating cache", async () => {
    await renderConversationMessages(mockUseNavigate, false);
  });

  it("should render conversations of messages with media by receiver", async () => {
    await renderConversationMessages(mockUseNavigate, false, {
      media: "image/png",
    });
  });

  it("should render conversations of deleted messages by receiver", async () => {
    await renderConversationMessages(mockUseNavigate, false, {
      deleted: true,
    });
  });

  it("should render conversations of missed call messages by receiver", async () => {
    await renderConversationMessages(mockUseNavigate, false, {
      missed: true,
    });
  });

  it("should not render conversations when user session is expired", async () => {
    const getConversations = generateConversations(0, 0, {
      error: "User not authenticated.",
    });
    await renderConversations(mockUseNavigate, 0, getConversations, {
      authUser: createUserType(),
    });
  });

  it("should search for a user", async () => {
    const total = 3;
    const pages = 2;
    const getConversations = generateConversations(total, pages);
    const find = generateFindUsers(testHandles.find, usersFound);
    const none = generateFindUsers(testHandles.none, 0);
    await renderConversations(mockUseNavigate, pages, getConversations, {
      authUser: createUserType(),
      mocks: [find.response, none.response],
    });

    await testHandleSearch("Find User", find.users);
  });

  it("should close conversation tab", async () => {
    const getConversations = generateConversations(0, 0, {
      error: "__error__",
    });
    await renderConversations(mockUseNavigate, 0, getConversations, {
      authUser: createUserType(),
      messenger: true,
      subscriptionCacheUpdate: false,
    });

    // 👇 conversations tab
    let conversationsTab = screen.queryByTestId("tab-conversations");
    expect(conversationsTab).toBeVisible();
    const close = screen.getByTestId("close-conversations");
    // 👇 clean up a mock's usage data between assertions
    mockUseNavigate.mockClear();
    // 👇 trigger close conversations tab
    fireEvent.click(close);
    await wait(() => {
      conversationsTab = screen.queryByTestId("tab-conversations");
      expect(conversationsTab).toBeNull();
      // 👇 should try navigating to homepage
      expect(mockUseNavigate).toHaveBeenCalledTimes(1);
      expect(mockUseNavigate).toHaveBeenCalledWith("/");
    });
  });
});
