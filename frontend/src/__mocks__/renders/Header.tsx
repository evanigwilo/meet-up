// 👇 React Testing
import { cleanup, render, screen } from "@testing-library/react";
// 👇 Components
import Header from "../../components/Header";
import MockProvider from "../components/MockProvider";
// 👇 Constants, Helpers & Types
import { SEO } from "../../utils/constants";
import { Mocks } from "../utils/types";
import * as helpers from "../../utils/helpers";
import { UserType } from "../../utils/types";
import {
  createAuth,
  createConversations,
  createMessage,
  createNotification,
  createUserType,
  findByAttribute,
  mockAvatarUrl,
  mockIntersectionObserver,
  mockSubscriptions,
  resolved,
  testObserverCount,
  wait,
} from "../utils/helpers";

const renderComponent = async (
  mocks: Mocks,
  authUser?: UserType,
  messenger?: boolean
) => {
  jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  // 👇 IntersectionObserver isn't available in test environment;
  mockIntersectionObserver();

  render(
    <MockProvider mocks={mocks}>
      <Header messenger={messenger} />
    </MockProvider>
  );

  await wait(() => {
    // 👇 page title
    const title = screen.getByText(findByAttribute("a", "href", "/"));
    expect(title).toBeVisible();
    // 👇 search bar
    const search = screen.getByPlaceholderText(`Search ${SEO.title}`);
    expect(search).toBeVisible();
    expect(search).toHaveValue("");
    // 👇 login icon
    const login = screen.queryByText(findByAttribute("a", "href", "/login"));
    // 👇 logout icon
    const logout = screen.queryByTestId("logout");
    // 👇 messages icon
    const messages = screen.queryByTestId("messages");
    // 👇 notifications icon
    const notifications = screen.queryByTestId("notifications");
    // 👇 profile icon
    const profile = screen.queryByText(
      findByAttribute("a", "href", helpers.authPath(authUser))
    );
    if (authUser) {
      expect(login).toBeNull();
      expect(logout).toBeVisible();
      expect(messages).toBeVisible();
      expect(notifications).toBeVisible();
      expect(profile).toBeVisible();
    } else {
      expect(login).toBeVisible();
      expect(logout).toBeNull();
      expect(messages).toBeNull();
      expect(notifications).toBeNull();
      expect(profile).toBeNull();
    }
  });
};

export default async (
  mocks: Mocks = [],
  authentication = [true],
  args?: Partial<{
    messenger: boolean;
    authUser: UserType;
    conversationError: boolean;
    notificationAlert: ReturnType<typeof mockSubscriptions.notification>;
    messageAlert: ReturnType<typeof mockSubscriptions.message>;
  }>
) => {
  // 👇 defining mocked responses for user authenticated status
  mocks = [
    // 👇 mocked subscriptions on header render
    mockSubscriptions.conversations(createConversations()),
    args?.notificationAlert ||
      mockSubscriptions.notification(createNotification("POST_CREATE", "id")),
    args?.messageAlert ||
      mockSubscriptions.message(createMessage("DELETED_MESSAGE")),
    ...mocks,
  ];

  // 👇 spy on method calls
  const spyTestObserver = jest.spyOn(helpers, "testObserver").mockClear();
  const spySleep = jest.spyOn(helpers, "sleep").mockImplementation(resolved);

  for (const authenticated of authentication) {
    const authUser = authenticated
      ? args?.authUser || createUserType()
      : undefined;
    // 👇 add user authentication status
    mocks.push(createAuth(authenticated, authUser));
    // 👇 render and test component based on authentication
    await renderComponent(mocks, authUser, args?.messenger);

    // 👇 notification alert
    const noAlert = !Boolean(args?.notificationAlert || args?.messageAlert);
    if (authUser?.token !== "CALL_OFFER" && noAlert) {
      const alert = screen.queryByTestId("alert");
      expect(alert).toBeNull();
    }
    // 👇 NOTE: method calls with subscriptions returns inconsistent 'fetch more' calls
    const calls = spyTestObserver.mock.calls;
    // 👇 fetch conversation calls
    if (args?.messenger) {
      expect(testObserverCount(calls, "FETCH")).toEqual(1);
      if (args.conversationError) {
        expect(testObserverCount(calls, "FETCH_MORE")).toEqual(0);
      } else {
        expect(testObserverCount(calls, "FETCH_MORE")).toBeGreaterThan(0);
      }
    } else {
      expect(testObserverCount(calls, "FETCH")).toEqual(0);
      expect(testObserverCount(calls, "FETCH_MORE")).toEqual(0);
    }
    await wait(() => {
      // 👇 authentication calls twice for socket and context providers
      expect(testObserverCount(calls, "AUTHENTICATION")).toEqual(2);
    });

    // 👇 clean up a mock's usage data between assertions
    spyTestObserver.mockClear();

    if (authentication.length > 1) {
      // 👇 remove user authentication status
      mocks.pop();
      // 👇 unmounts react trees that were mounted with render.
      cleanup();
    }
  }

  return {
    spyTestObserver,
  };
};
