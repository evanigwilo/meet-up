// 👇 React Testing
import { cleanup, screen, fireEvent, act } from "@testing-library/react";
// 👇 Services
import dayjs from "../../services/dayjs";
// 👇 Renders
import renderHeader from "../../__mocks__/renders/Header";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { NotificationType, UserType } from "../../utils/types";
import { disabledElement } from "../../__mocks__/utils/constants";
import { Mocks } from "../../__mocks__/utils/types";
import {
  findTextContent,
  wait,
  findErrorText,
  findMediaElement,
  createUserType,
  testObserverCount,
  generateNotifications,
  createTransitionendEvent,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

// 👇 check user notifications
const testNotifications = (
  total: number,
  pages: number,
  notifications: ReturnType<typeof generateNotifications>,
  type: NotificationType["type"]
) => {
  const count = total * pages;
  // 👇 check user notifications
  const queryNotifications = screen.getAllByTestId(/^notifications-/);
  expect(queryNotifications).toHaveLength(count);
  // 👇 check if error was rendered
  const firstPage = notifications[0].result;
  if ("errors" in firstPage) {
    // 👇 error text display should exist
    const errorElement = screen.getByText(
      findErrorText(firstPage.errors[0].extensions.getNotifications as string)
    );
    expect(errorElement).toBeVisible();
    return;
  }
  const notification = firstPage.data.getNotifications[0];

  // 👇 created date
  const formatDate = dayjs(Number(notification.createdDate)).fromNow();
  const createdDate = screen.getAllByText(findTextContent(formatDate));
  expect(createdDate).toHaveLength(count);

  const format = helpers.messageFormat({
    type,
    name: notification.from.name,
  });
  if (type === "PROFILE_UPDATE") {
    // 👇 same title for profile update
    const title = screen.getAllByText(findTextContent(format.message.text));
    expect(title).toHaveLength(count);
  }
  // 👇 icon
  const icon = screen.getAllByText(findTextContent(format.icon.text));
  expect(icon).toHaveLength(count);

  // 👇 test each notification element
  notifications.forEach((pages) => {
    const page = pages.result as {
      data: {
        getNotifications: NotificationType[];
      };
    };
    page.data.getNotifications.forEach((notification) => {
      if (type !== "PROFILE_UPDATE") {
        // 👇 title
        const format = helpers.messageFormat({
          type,
          name: notification.from.name,
        });
        const title = screen.getByText(findTextContent(format.message.text));
        expect(title).toBeVisible();
      }
      // 👇 profile
      const profile = screen.getByText(
        findMediaElement(helpers.avatarUrl(notification.from.id))
      );
      expect(profile).toBeVisible();
    });
  });
};

const clickNotification = async (
  notifications: ReturnType<typeof generateNotifications>
) => {
  const firstPage = notifications[0].result;
  // 👇 check if error was rendered
  if ("errors" in firstPage) {
    return;
  }
  // 👇 destructure notification object
  const { id, identifier, type } = firstPage.data.getNotifications[0];
  const notification = screen.getByTestId(`notifications-${id}`);
  // 👇 clean up a mock's usage data between assertions
  mockUseNavigate.mockClear();
  // 👇 trigger clicking notification
  fireEvent.click(notification);
  await wait(() => {
    // 👇 should try navigating based on type
    expect(mockUseNavigate).toHaveBeenCalledTimes(1);
    switch (type) {
      case "POST_CREATE":
      case "POST_LIKE":
        expect(mockUseNavigate).toHaveBeenCalledWith(`/post/${identifier}`);
        break;
      case "PROFILE_UPDATE":
      case "FOLLOWING_YOU":
        const authPath =
          "/user/" +
          helpers.authKey(identifier) +
          identifier.substring(identifier.indexOf("/"));
        expect(mockUseNavigate).toHaveBeenCalledWith(authPath);
        break;
      default:
        break;
    }
    // 👇 notifications tab should have opacity of 0
    const notificationsTab = screen.queryByTestId("tab-notifications");
    expect(notificationsTab).toHaveStyle(disabledElement);
  });
};

const renderNotifications = async (
  pages: number,
  authUser: UserType | undefined,
  notifications: ReturnType<typeof generateNotifications>,
  mocks: Mocks = []
) => {
  const firstPage = notifications[0].result;
  // 👇 check if error should be rendered
  const error = "errors" in firstPage;
  mocks.push(...notifications);

  // 👇 clean up a mock's usage data between assertions
  mockUseNavigate.mockClear();

  const { spyTestObserver } = await renderHeader(mocks, [true], {
    authUser,
  });

  // 👇 notifications icon
  const notificationIcon = screen.getByTestId("notifications");
  // 👇 trigger show notifications
  fireEvent.click(notificationIcon);

  await wait(() => {
    // 👇 finished pagination
    const finished = screen.queryByText(findTextContent("Finished."));
    if (error) {
      expect(finished).toBeNull();
    } else {
      expect(finished).toBeVisible();
    }
  });

  // 👇 no navigation
  expect(mockUseNavigate).toHaveBeenCalledTimes(0);

  // 👇 notifications tab
  const notificationsTab = screen.getByTestId("tab-notifications");
  expect(notificationsTab).toBeVisible();
  const notificationsText = screen.getByText(findTextContent("Notifications"));
  const close = screen.getByTestId("close-notifications");
  expect(notificationsText).toBeVisible();
  expect(close).toBeVisible();

  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 fetch notification calls
  expect(testObserverCount(calls, "FETCH")).toEqual(1);
  expect(testObserverCount(calls, "FETCH_MORE")).toEqual(error ? 0 : pages + 1);
};

const renderNotificationType = async (type: NotificationType["type"]) => {
  const total = 3;
  const pages = 2;
  const getNotifications = generateNotifications(total, pages, {
    type,
    identifier: helpers.uniqueId(),
  });

  const authUser = createUserType();

  await renderNotifications(pages, authUser, getNotifications);

  await wait(() => testNotifications(total, pages, getNotifications, type));

  await clickNotification(getNotifications);
};

describe("Notifications", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render created post notifications", async () => {
    await renderNotificationType("POST_CREATE");
  });

  it("should render following notifications", async () => {
    await renderNotificationType("FOLLOWING_YOU");
  });

  it("should render liked post notifications", async () => {
    await renderNotificationType("POST_LIKE");
  });

  it("should render profile update notifications", async () => {
    await renderNotificationType("PROFILE_UPDATE");
  });

  it("should not render notifications when user session is expired", async () => {
    const getNotifications = generateNotifications(0, 0, {
      error: "User not authenticated.",
    });
    await renderNotifications(0, createUserType(), getNotifications);
  });

  it("should close notifications tab", async () => {
    const getNotifications = generateNotifications(0, 0, {
      error: "User not authenticated.",
    });
    await renderNotifications(0, createUserType(), getNotifications);

    const close = screen.getByTestId("close-notifications");
    // 👇 trigger close notifications tab
    fireEvent.click(close);
    await wait(async () => {
      // 👇 notifications tab should have opacity of 0
      const notificationsTab = screen.queryByTestId("tab-notifications");
      expect(notificationsTab).toHaveStyle(disabledElement);
    });
    // 👇 mock and dispatch 'transitionend' event
    await act(async () => {
      const notificationsTab = screen.getByTestId("tab-notifications");
      notificationsTab.dispatchEvent(createTransitionendEvent());
    });
    await wait(() => {
      // 👇 notifications tab tab should be closed
      const notificationsTab = screen.queryByTestId("tab-notifications");
      expect(notificationsTab).toBeNull();
    });
  });
});
