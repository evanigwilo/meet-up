// 👇 React Testing
import { cleanup, screen, fireEvent, act } from "@testing-library/react";
// 👇 Services
import dayjs from "../../services/dayjs";
// 👇 Renders
import renderHeader from "../../__mocks__/renders/Header";
// 👇 Constants, Helpers & Types
import { SEO } from "../../utils/constants";
import { avatarUrl, secsToMs, messageFormat } from "../../utils/helpers";
import {
  disabledElement,
  enabledElement,
  testHandles,
  usersFound,
} from "../../__mocks__/utils/constants";
import {
  wait,
  testObserverCount,
  generateFindUsers,
  testHandleSearch,
  mockMutations,
  mockSubscriptions,
  createMessage,
  findCloseElement,
  findMediaElement,
  findTextContent,
  createUserType,
  createTransitionendEvent,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

describe("Header", () => {
  afterEach(() => {
    // 👇 use real timers
    jest.useRealTimers();
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render header", async () => {
    await renderHeader([], [true, false]);
  });

  it("should log out", async () => {
    // 👇 clean up a mock's usage data between assertions
    mockUseNavigate.mockClear();
    const { spyTestObserver } = await renderHeader([mockMutations.logout()]);
    // 👇 logout icon
    const logout = screen.getByTestId("logout");
    // 👇 trigger user log out
    fireEvent.click(logout);
    await wait(() => {
      // 👇 method calls
      const calls = spyTestObserver.mock.calls;
      // 👇 log out calls
      expect(testObserverCount(calls, "LOG_OUT")).toEqual(1);
      // 👇 should try reload page
      expect(mockUseNavigate).toHaveBeenCalledTimes(1);
      expect(mockUseNavigate).toHaveBeenCalledWith(0);
    });
  });

  it("should search for a user", async () => {
    const find = generateFindUsers(testHandles.find, usersFound);
    const none = generateFindUsers(testHandles.none, 0);
    await renderHeader([find.response, none.response]);

    await testHandleSearch(`Search ${SEO.title}`, find.users, true);
  });

  it("should show new message notification", async () => {
    const type = "NEW_MESSAGE";
    const message = createMessage(type);
    const format = messageFormat({
      type,
      name: message.from.name,
    });
    // 👇 fake timers for manually advancing intervals
    jest.useFakeTimers();
    await renderHeader([], [true], {
      messageAlert: mockSubscriptions.message(message),
    });
    // 👇 new message notification alert
    const alert = screen.getByTestId("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveStyle(enabledElement);
    // 👇 hide notification button
    const close = screen.queryByText(findCloseElement);
    expect(close).toBeVisible();
    // 👇 sender profile
    const profile = screen.getByText(
      findMediaElement(avatarUrl(message.from.id))
    );
    expect(profile).toBeVisible();
    // 👇 notification icon
    const icon = screen.getByText(findTextContent(format.icon.text));
    expect(icon).toBeVisible();
    // 👇 notification info
    const info = screen.getByText(findTextContent(format.message.text));
    expect(info).toBeVisible();
    // 👇 notification sub info
    const date = screen.getByText(
      findTextContent(dayjs(Number(message.createdDate)).fromNow())
    );
    expect(date).toBeVisible();

    // 👇 advance time to hide notification alert
    jest.advanceTimersByTime(secsToMs(5));
    await wait(() => {
      // 👇 notification alert should be hidden and disabled
      expect(alert).toHaveStyle(disabledElement);
    });
    // 👇 mock and dispatch 'transitionend' event
    await act(async () => {
      alert.dispatchEvent(createTransitionendEvent());
    });
    await wait(() => {
      // 👇 notification alert should not exist
      const alert = screen.queryByTestId("alert");
      expect(alert).toBeNull();
    });
  });

  it("should show unseen notifications and conversations count", async () => {
    // 👇 mock notification and conversations counts
    const conversations = 50;
    const postLike = 5;
    const followers = 15;
    const authUser = createUserType({
      notifications: [
        {
          total: conversations,
          type: "CONVERSATIONS",
        },
        {
          total: postLike,
          type: "POST_LIKE",
        },
        {
          total: followers,
          type: "FOLLOWING_YOU",
        },
      ],
    });
    await renderHeader([], [true], {
      authUser,
    });

    // 👇 displays the correct notification and conversations counts
    const notificationsBadge = screen.getByTestId("notifications");
    expect(notificationsBadge).toHaveAttribute(
      "data-total",
      (postLike + followers).toString()
    );
    const conversationsBadge = screen.getByTestId("messages");
    expect(conversationsBadge).toHaveAttribute(
      "data-total",
      conversations.toString()
    );
  });
});
