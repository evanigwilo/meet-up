// 👇 React Testing
import { cleanup, screen, fireEvent } from "@testing-library/react";
// 👇 Renders
import renderHeader from "../../__mocks__/renders/Header";
import renderChats from "../../__mocks__/renders/Chat";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { userCalling } from "../../__mocks__/utils/constants";
import { enabledElement } from "../../__mocks__/utils/constants";
import { CallStatus, Mocks } from "../../__mocks__/utils/types";
import {
  findTextContent,
  wait,
  findMediaElement,
  createUserType,
  testObserverCount,
  mockSubscriptions,
  createMessage,
  generateConversations,
  findCloseElement,
  mockObjectURL,
  mockAvatarUrl,
  mockMatchMedia,
} from "../../__mocks__/utils/helpers";

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate,
}));

const renderVideoCall = async (
  status: CallStatus,
  display?: string,
  cancel?: boolean
) => {
  const { spyTestObserver, user, other } = await renderChats(mockUseNavigate, {
    sender: true,
    body: true,
    call: {
      status,
    },
  });

  const startVideoCall = screen.getByTestId("start-video-call");
  // 👇 trigger calling other user
  fireEvent.click(startVideoCall);
  await wait(async () => {
    const callVideo = screen.getByTestId<HTMLMediaElement>("video-call");
    expect(callVideo).toBeVisible();
    const answerVideo = screen.queryByTestId<HTMLMediaElement>("video-answer");
    expect(answerVideo).toBeNull();
    // 👇 video stream should have loaded
    expect(callVideo.srcObject || callVideo.src).toBeTruthy();
  });

  const testId = status === "UNAUTHENTICATED" ? "error" : "status";
  const callStatus = screen.queryByTestId(testId);
  expect(callStatus).toBeNull();
  // 👇 trigger loading of video metadata to play video stream
  const callVideo = screen.getByTestId<HTMLMediaElement>("video-call");
  fireEvent.loadedMetadata(callVideo);

  if (status === "ANSWER_OFFER") {
    await wait(() => {
      const callStatus = screen.queryByTestId(testId);
      expect(callStatus).toBe(null);
      const answerVideo = screen.getByTestId<HTMLMediaElement>("video-answer");
      expect(answerVideo).toBeVisible();
      expect(answerVideo.srcObject || answerVideo.src).toBeTruthy();
    });
    // 👇 end call icon
    const endCall = screen.getByTestId("End");
    expect(endCall).toBeVisible();
    return;
  }

  await wait(() => {
    const callStatus = screen.getByTestId(testId);
    expect(callStatus.textContent).toContain(display);
  });
  // 👇 check respective call backgrounds
  const callBackground = screen.getByTestId("call-background");
  const answerBackground = screen.getByTestId("answer-background");
  expect(callBackground).toHaveStyle({
    "background-image": `url(${helpers.avatarUrl(user.id)})`,
  });
  expect(answerBackground).toHaveStyle({
    "background-image": `url(${helpers.avatarUrl(other.id)})`,
  });

  // 👇 get the other user profile in chat header and video call profile
  const answerProfile = screen.getAllByText(
    findMediaElement(helpers.avatarUrl(other.id))
  );
  expect(answerProfile).toHaveLength(2);

  if (testId === "error") {
    const calling = screen.getByText(findTextContent("Calling..."));
    expect(calling).toBeVisible();
    // 👇 calling loader bars
    const bars = screen.getByTestId("bars");
    expect(bars).toBeVisible();
    // 👇 end call icon
    const endCall = screen.getByTestId("End");
    expect(endCall).toBeVisible();

    if (cancel) {
      // 👇 trigger clicking canceling calling
      fireEvent.click(endCall);
      await wait(() => {
        const callStatus = screen.getByTestId("status");
        expect(callStatus.textContent).toContain("CALL CANCELED");
      });
    }
  }
  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 signal date between peers
  expect(testObserverCount(calls, "PEER_SIGNAL_EVENT")).toEqual(1);
  if (cancel) {
    // 👇 'call canceled' socket message sent
    expect(testObserverCount(calls, "CALL_CANCELED")).toEqual(1);
  }
};

const testCallAlert = async () => {
  const authUser = createUserType({
    token: "CALL_OFFER",
  });
  const mocks: Mocks = [];
  mocks.push(mockSubscriptions.message(createMessage("NEW_MESSAGE")));
  mocks.push(...generateConversations(1, 1));
  const { spyTestObserver } = await renderHeader(mocks, [true], {
    authUser,
  });
  // 👇 incoming call notification alert
  const alert = screen.getByTestId("alert");
  expect(alert).toBeVisible();
  expect(alert).toHaveStyle(enabledElement);
  // 👇 hide notification button
  const close = screen.queryByText(findCloseElement);
  expect(close).toBeVisible();
  // 👇 caller profile
  const profile = screen.getByText(
    findMediaElement(helpers.avatarUrl(userCalling.id))
  );
  expect(profile).toBeVisible();
  // 👇 caller name
  const name = screen.getByText(findTextContent(userCalling.name));
  expect(name).toBeVisible();
  // 👇 alert info
  const info = screen.getByText(findTextContent("Incoming Video Call"));
  expect(info).toBeVisible();
  // 👇 decline call icon
  const declineCall = screen.getByTestId("Decline");
  expect(declineCall).toBeVisible();
  // 👇 accept call icon
  const acceptCall = screen.getByTestId("Accept");
  expect(acceptCall).toBeVisible();

  return { spyTestObserver, acceptCall, declineCall };
};

describe("Video Call", () => {
  beforeAll(() => {
    // 👇 mock object URL representing the specified File object or Blob object
    mockObjectURL();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    // 👇 prevent unstable_flushDiscreteUpdates error message
    Object.defineProperty(HTMLMediaElement.prototype, "muted", {
      configurable: true,
      set: jest.fn(),
    });
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: {
        getUserMedia: () => {
          return new Promise((resolve) => {
            resolve({
              getTracks: () => [],
            });
          });
        },
      },
    });
    mockMatchMedia();
    // mock avatar url for consistent value in DOM testing
    jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  });

  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should call a user who answered", async () => {
    await renderVideoCall("ANSWER_OFFER");
  });

  it("should call a user who did not answer", async () => {
    await renderVideoCall("NO_ANSWER", "NO ANSWER");
  });

  it("should call a user who is offline", async () => {
    await renderVideoCall("USER_OFFLINE", "OFFLINE");
  });

  it("should call a user who is busy", async () => {
    await renderVideoCall("USER_BUSY", "BUSY");
  });

  it("should fail to call a user when session has expired", async () => {
    await renderVideoCall("UNAUTHENTICATED", "User not authenticated.");
  });

  it("should cancel calling a user", async () => {
    await renderVideoCall("UNAUTHENTICATED", "User not authenticated.", true);
  });

  it("should accept incoming call", async () => {
    const { spyTestObserver, acceptCall } = await testCallAlert();
    // 👇 trigger accepting call
    fireEvent.click(acceptCall);
    await wait(() => {
      const alert = screen.queryByTestId("alert");
      expect(alert).toBeNull();
    });
    // 👇 trigger loading of video metadata to play video stream
    const callVideo = screen.getByTestId<HTMLMediaElement>("video-call");
    fireEvent.loadedMetadata(callVideo);
    await wait(() => {
      // 👇 method calls
      const calls = spyTestObserver.mock.calls;
      // 👇 signal date between peers
      expect(testObserverCount(calls, "PEER_SIGNAL_EVENT")).toEqual(1);
    });
  });

  it("should decline incoming call", async () => {
    const { spyTestObserver, declineCall } = await testCallAlert();
    // 👇 trigger declining call
    fireEvent.click(declineCall);
    await wait(() => {
      const alert = screen.queryByTestId("alert");
      expect(alert).toBeNull();
    });
    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 socket sends user busy message
    expect(testObserverCount(calls, "USER_BUSY")).toEqual(1);
  });
});
