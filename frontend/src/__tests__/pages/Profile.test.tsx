// 👇 React Testing
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// 👇 Pages
import Profile from "../../pages/Profile";
// 👇 Services
import axios from "../../services/axios";
import { AxiosRequestConfig } from "axios";
// 👇 Components
import MockProvider from "../../__mocks__/components/MockProvider";
// 👇 React Router
import Router from "react-router-dom";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { Mocks } from "../../__mocks__/utils/types";
import {
  AuthInput,
  Follow,
  GqlQueries,
  TestObserver,
  UserType,
} from "../../utils/types";
import {
  flexDisplay,
  followCount,
  nbsp,
  noDisplay,
  trueFalse,
} from "../../__mocks__/utils/constants";
import {
  createAuth,
  mockMutations,
  resolved,
  findTextContent,
  wait,
  findErrorText,
  findMediaElement,
  mockIntersectionObserver,
  createUserType,
  mockQueries,
  findByClass,
  testPostElement,
  generatePosts,
  generateUsers,
  findInputFileElement,
  createFile,
  changeFile,
  testObserverCount,
  testUser,
  mockAvatarUrl,
  mockUploadProgress,
  errorChangeFile,
} from "../../__mocks__/utils/helpers";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
}));

const selections = {
  posts: "Posts",
  replies: "Replies",
  media: "Media",
  likes: "Likes",
  following: "following",
  followers: "followers",
};

const checkSelection = (selection: keyof typeof selections) => {
  // 👇 selected style color
  const selected = { color: "white" };
  for (const _select in selections) {
    // 👇 cast to selection type
    const select = _select as typeof selection;
    const followType = selections[select].startsWith("follow");
    const findSelect = followType
      ? screen.getByTestId(selections[select])
      : screen.getByText(findTextContent(selections[select]));
    expect(findSelect).toBeVisible();
    const followText = followType
      ? screen.getByTestId(`${selections[select]}-text`)
      : findSelect;
    // 👇 selected style based on current selection
    if (select === selection) {
      expect(followText).toHaveStyle(selected);
    } else {
      expect(followText).not.toHaveStyle(selected);
    }
  }
};

// 👇 check user posts
const testPosts = (
  postCount: number,
  postPages: number,
  query: Extract<
    GqlQueries,
    "getUserPosts" | "getUserComments" | "getUserMedias" | "getUserLikes"
  >,
  posts: ReturnType<typeof generatePosts>
) => {
  // 👇 check user posts
  const queryPosts = screen.queryAllByTestId(/^post-/);
  // 👇 check comments
  const queryComments = screen.queryAllByTestId(/^reply-/);
  if (query === "getUserComments") {
    expect(queryComments).toHaveLength(postCount * postPages);
    expect(queryPosts).toHaveLength(0);
  } else {
    expect(queryPosts).toHaveLength(postCount * postPages);
    expect(queryComments).toHaveLength(0);
  }
  // 👇 test each post element
  posts.forEach((pages) => {
    pages.result.data[query].forEach((post) => {
      testPostElement(post);
    });
  });
};

// 👇 check user follows
const testUserElement = (
  user: UserType,
  query: Extract<GqlQueries, "getFollowers" | "getFollowing">,
  authenticated: boolean
) => {
  testUser(user, true);
  // 👇 follow button
  const followingButton = getFollowButton(user);
  // 👇 mutual status
  const mutual = getMutualText(user);
  // 👇 follow status based on user authenticated state
  if (authenticated) {
    if (user.mutual) {
      expect(mutual).toBeVisible();
      expect(mutual).toHaveTextContent("👥 Mutual");
    } else {
      expect(mutual).toBeNull();
    }
    expect(followingButton).toBeVisible();
    if (query === "getFollowing") {
      expect(followingButton).toHaveTextContent("Following");
    } else {
      if (user.mutual) {
        expect(followingButton).toHaveTextContent("Following");
      } else {
        expect(followingButton).toHaveTextContent("Follow");
      }
    }
  } else {
    expect(followingButton || mutual).toBeNull();
  }
};

// 👇 check user following or followers
const testFollows = (
  total: number,
  pages: number,
  query: Extract<GqlQueries, "getFollowers" | "getFollowing">,
  users: ReturnType<typeof generateUsers>,
  authenticated: boolean
) => {
  // 👇 check users
  const queryUsers = screen.queryAllByTestId(/^user-/);
  expect(queryUsers).toHaveLength(total * pages);
  // 👇 test each user element
  users.forEach((pages) => {
    pages.result.data[query].forEach((user) => {
      testUserElement(user, query, authenticated);
    });
  });
};

const testFollowButton = async (
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>,
  user: UserType,
  follow?: Follow
) => {
  let status = "mutual";
  if (follow) {
    const { followers, following } = follow;
    if (followers > following) {
      status = "follower";
    } else if (following > followers) {
      status = "following";
    } else if (following < 1 && followers < 1) {
      status = "none";
    }
  }
  // 👇 follow button
  let followButton = getFollowButton(user);
  // 👇 mutual status visible
  let mutual = getMutualText(user);
  if (status === "mutual") {
    expect(mutual).toHaveTextContent("👥 Mutual");
  } else if (status === "follower") {
    expect(mutual).toHaveTextContent("Follows you");
  } else {
    expect(mutual).toBeNull();
  }
  // 👇 follow button mouse hover
  userEvent.hover(followButton!);
  if (status === "none" || status === "follower") {
    expect(followButton).toHaveTextContent("Follow?");
  } else {
    expect(followButton).toHaveTextContent("Unfollow?");
  }
  // 👇 follow button mouse leave
  userEvent.unhover(followButton!);
  if (status === "none" || status === "follower") {
    expect(followButton).toHaveTextContent("Follow");
  } else {
    expect(followButton).toHaveTextContent("Following");
  }
  // 👇 clean up a mock's usage data between two assertions
  spyTestObserver.mockClear();
  // 👇 trigger unfollow
  fireEvent.click(followButton!);
  await wait(() => {
    followButton = getFollowButton(user);
    if (follow) {
      // 👇 follow status and follow/unfollow user mutation should have been called
      expect(spyTestObserver).toHaveBeenCalledTimes(2);
      if (status === "none" || status === "follower") {
        // 👇 follow user mutation should have been called
        expect(spyTestObserver).toHaveBeenNthCalledWith<TestObserver[]>(
          1,
          "FOLLOW_USER"
        );
        expect(followButton).toHaveTextContent("Following");
      } else {
        // 👇 unfollow user mutation should have been called
        expect(spyTestObserver).toHaveBeenNthCalledWith<TestObserver[]>(
          1,
          "UNFOLLOW_USER"
        );
        expect(followButton).toHaveTextContent("Follow");
      }
      expect(spyTestObserver).toHaveBeenNthCalledWith<TestObserver[]>(
        2,
        "FOLLOW_STATUS"
      );
    } else {
      // 👇 unfollow user mutation should have been called
      expect(spyTestObserver).toHaveBeenCalledTimes(1);
      expect(spyTestObserver).toHaveBeenCalledWith<TestObserver[]>(
        "UNFOLLOW_USER"
      );
      expect(followButton).toHaveTextContent("Follow");
    }
  });

  if (!follow) {
    // 👇 no mutual status
    mutual = getMutualText(user);
    expect(mutual).toBeNull();

    // 👇 clean up a mock's usage data between two assertions
    spyTestObserver.mockClear();
    // 👇 trigger follow
    fireEvent.click(followButton!);
    await wait(() => {
      // 👇 follow user mutation should have been called
      expect(spyTestObserver).toHaveBeenCalledTimes(1);
      expect(spyTestObserver).toHaveBeenCalledWith<TestObserver[]>(
        "FOLLOW_USER"
      );
      followButton = getFollowButton(user);
      expect(followButton).toHaveTextContent("Following");
    });
  }
};

const renderComponent = async (
  mocks: Mocks,
  user: UserType,
  followCount: Follow,
  authenticated = false
) => {
  jest.spyOn(helpers, "sleep").mockImplementation(resolved);
  // mock avatar url for consistent value in DOM testing
  jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  jest.spyOn(Router, "useParams").mockReturnValue({
    auth: user.auth,
    username: user.username,
  });
  // mock scroll to
  jest.spyOn(window, "scrollTo").mockImplementation();
  // 👇 IntersectionObserver isn't available in test environment;
  mockIntersectionObserver();

  render(
    <MockProvider mocks={mocks}>
      <Profile />
    </MockProvider>
  );

  await wait(() => {
    // 👇 finished pagination
    const finished = screen.getByText(findTextContent("Finished."));
    expect(finished).toBeVisible();

    // 👇 get following and follower counts
    const following = screen.getByTestId("following");
    expect(following).toBeVisible();
    expect(following.textContent).toEqual(
      `${followCount.following}${nbsp}Following${nbsp}`
    );
    const followers = screen.getByTestId("followers");
    expect(followers).toBeVisible();
    expect(followers.textContent).toEqual(
      `${followCount.followers}${nbsp}Followers${nbsp}`
    );
    // 👇 get profile background
    const background = screen.getByTestId("profile-background");
    expect(background).toBeVisible();
    // 👇 get user details
    const username = screen.getByText(findTextContent("@" + user.username));
    expect(username).toBeVisible();
    const name = screen.getByText(findTextContent(user.name));
    expect(name).toBeVisible();
    if (user.bio) {
      const bio = screen.getByTestId("bio-input");
      expect(bio).toHaveTextContent(user.bio);
      expect(bio).toBeVisible();
      expect(bio).not.toHaveAttribute("contenteditable", "true");
    }
    // 👇 profile image
    const profile = screen.getByText(
      findMediaElement(helpers.avatarUrl(user.username, user.auth))
    );
    expect(profile).toBeVisible();
    // 👇 profile update icon
    const profileUpdate = screen.queryByText(findByClass("update"));
    // 👇 bio edit icon
    const bioEdit = screen.queryByTestId("bio-edit");
    // 👇 notification switch
    const notificationSwitch = screen.queryByTestId("notification-switch");
    if (authenticated) {
      expect(bioEdit).toBeVisible();
      // 👇 bio update and save icon
      const bioUpdate = screen.queryByTestId("bio-update");
      const bioSave = screen.queryByTestId("bio-save");
      expect(bioUpdate).toBeVisible();
      expect(bioSave).toBeNull();
      expect(profileUpdate).toBeVisible();
      expect(notificationSwitch).toBeVisible();
    } else {
      expect(bioEdit).toBeNull();
      expect(profileUpdate).toBeNull();
      expect(notificationSwitch).toBeNull();
    }
  });
  // 👇 selected options should be visible and 'Posts' should be selected initially
  checkSelection("posts");
};

const renderHelper = async (
  query: Extract<
    GqlQueries,
    | "getUserPosts"
    | "getUserComments"
    | "getUserMedias"
    | "getUserLikes"
    | "getFollowers"
    | "getFollowing"
  >,
  authentication = [false],
  args?: Partial<{
    toggle: boolean;
    mutual: boolean;
    bio: {
      body: string;
      error: string;
    };
    status: Follow;
    authUser: UserType;
    getUser: UserType;
  }>
) => {
  const total = 3;
  const pages = 2;
  const user =
    args?.getUser ||
    createUserType({
      bio: "My Bio.",
    });
  const authInput: AuthInput = {
    auth: user.auth,
    username: user.username,
  };
  const queryPosts = mockQueries.getUserPosts(authInput, total, pages);
  // 👇 defining mocked responses
  const mocks: Mocks = [
    mockQueries.getUser(authInput, user),
    mockQueries.getFollowCount(authInput, followCount),
    ...queryPosts,
  ];

  const queryFollow = query === "getFollowers" || query === "getFollowing";
  const queryUserPosts = query === "getUserPosts";
  const postsOrUsers = queryUserPosts
    ? queryPosts
    : queryFollow
    ? mockQueries[query](authInput, total, pages, args?.mutual)
    : mockQueries[query](authInput, total, pages);

  if (!queryUserPosts) {
    mocks.push(...postsOrUsers);
  }
  // 👇 querying followers or following will refetch follow count
  if (queryFollow) {
    // 👇 generate mutations for following and unfollowing the first user in the following / follower list
    const user = postsOrUsers[0].result.data[query][0] as UserType;
    const followInput: AuthInput = {
      auth: user.auth,
      username: user.username,
    };
    mocks.push(mockMutations.followUser(followInput));
    mocks.push(mockMutations.unFollowUser(followInput));
    mocks.push(mockQueries.getFollowCount(authInput, followCount));
  }
  // 👇 generate mutations for bio update
  if (args?.bio) {
    const { body, error } = args.bio;
    mocks.push(mockMutations.updateBio(body));
    mocks.push(mockMutations.updateBio("__error__", error));
  }
  // 👇 generate mutations for notification alert toggle
  if (args?.toggle) {
    trueFalse.forEach((toggle) =>
      mocks.push(mockMutations.toggleNotification(toggle))
    );
  }
  // 👇 generate mutations for follow/unfollow a user
  if (args?.getUser) {
    mocks.push(mockMutations.followUser(authInput));
    mocks.push(mockMutations.unFollowUser(authInput));
  }

  // 👇 spy mocks
  const spyAxiosPost = jest.spyOn(axios, "post").mockClear();
  const spyTestObserver = jest.spyOn(helpers, "testObserver").mockClear();

  const authUser = args?.authUser || user;
  for (const authenticated of authentication) {
    // 👇 add user authentication status
    mocks.push(createAuth(authenticated, authUser));

    const profile =
      authUser.auth === user.auth && authUser.username === user.username;
    const authProfile = authenticated && profile;
    // 👇 add follow status queries twice as updating 'follow status' with button triggers refetch
    if (authenticated && !profile) {
      const status = args?.status || {
        followers: 0,
        following: 0,
      };
      for (let i = 0; i < 2; i++) {
        mocks.push(mockQueries.getFollowStatus(authInput, status));
      }
    }
    // 👇 render and test component based on user authenticated status
    await renderComponent(mocks, user, followCount, authProfile);

    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    expect(testObserverCount(calls, "GET_USER")).toEqual(1);
    expect(testObserverCount(calls, "FOLLOW_COUNT")).toEqual(1);
    await fetchCalls(spyTestObserver, pages);
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
    user,
    postsOrUsers,
    total,
    pages,
    spyAxiosPost,
    authInput,
    spyTestObserver,
  };
};

const renderSelection = async (
  query: Extract<
    GqlQueries,
    | "getUserPosts"
    | "getUserComments"
    | "getUserMedias"
    | "getUserLikes"
    | "getFollowers"
    | "getFollowing"
  >,
  select: keyof typeof selections,
  authenticated = false,
  mutual?: boolean
) => {
  const { postsOrUsers, total, pages, spyTestObserver } = await renderHelper(
    query,
    [authenticated],
    { mutual }
  );
  // 👇 selected options should be 'Posts' initially
  checkSelection("posts");
  const findSelect = selections[select].startsWith("follow")
    ? screen.getByTestId(selections[select])
    : screen.getByText(findTextContent(selections[select]));
  expect(findSelect).toBeVisible();
  // 👇 trigger changing selection
  fireEvent.click(findSelect!);
  await wait(() => {
    // 👇 selection should have changed
    checkSelection(select);
    // 👇 check posts or users
    if (query === "getFollowers" || query === "getFollowing") {
      testFollows(
        total,
        pages,
        query,
        postsOrUsers as ReturnType<typeof generateUsers>,
        authenticated
      );
    } else {
      testPosts(
        total,
        pages,
        query,
        postsOrUsers as ReturnType<typeof generatePosts>
      );
    }
  });

  if (select !== "posts") {
    // 👇 fetch calls
    await fetchCalls(spyTestObserver, pages);
  }
  return {
    postsOrUsers,
    spyTestObserver,
  };
};

const loadImage = async ({
  update,
  loader,
  percent,
  profile,
  progress,
}: {
  update: HTMLElement;
  loader: HTMLElement;
  percent: HTMLElement;
  profile: HTMLElement;
  progress: string;
}) => {
  // 👇 update icon should be hidden and loader should be visible
  expect(update).toHaveStyle(noDisplay);
  expect(loader).toHaveStyle(flexDisplay);
  // 👇 should show upload progress
  expect(percent).toHaveTextContent(progress);
  // 👇 simulate load event for image
  fireEvent.load(profile);
  // 👇 loading spinner should be hidden
  await wait(() => {
    // 👇 update icon should be visible and loader should be hidden
    expect(update).toHaveStyle(flexDisplay);
    expect(loader).toHaveStyle(noDisplay);
    // 👇 should have no upload progress
    expect(percent).toHaveTextContent("");
  });
};

const updateBio = async (
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>,
  bio: string,
  error: string = ""
) => {
  // 👇 bio edit icon
  const bioEdit = screen.queryByTestId("bio-edit");
  // 👇 bio update and save icon
  let bioUpdate = screen.queryByTestId("bio-update");
  let bioSave = screen.queryByTestId("bio-save");
  // 👇 get user bio
  let bioInput = screen.getByTestId("bio-input");
  expect(bioUpdate).toBeVisible();
  expect(bioSave).toBeNull();
  // 👇 clean up a mock's usage data between assertions
  spyTestObserver.mockClear();
  // 👇 trigger update icon
  fireEvent.click(bioEdit!);
  // 👇 check editing attributes
  await wait(() => {
    // 👇 update bio mutation should not have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(0);
    bioInput = screen.getByTestId("bio-input");
    bioUpdate = screen.queryByTestId("bio-update");
    bioSave = screen.queryByTestId("bio-save");
    expect(bioInput).toHaveAttribute("contenteditable", "true");
    expect(bioUpdate).toBeNull();
    expect(bioSave).toBeVisible();
  });

  // 👇 innerText leans on the layout engine for guidance, and jsdom has no layout engine
  bioInput.innerText = bioInput.textContent = bio;
  // 👇 bio value should have changed
  expect(bioInput).toHaveTextContent(bio);
  // 👇 clean up a mock's usage data between assertions
  spyTestObserver.mockClear();
  // 👇 trigger save icon
  fireEvent.click(bioEdit!);
  await wait(() => {
    // 👇 error text display should not exist
    const errorElement = screen.queryByText(findErrorText(error));
    if (bio === "__error__") {
      expect(errorElement).toBeVisible();
    } else {
      expect(errorElement).toBeNull();
    }
  });
  // 👇 update bio mutation should have been called
  expect(spyTestObserver).toHaveBeenCalledTimes(1);
  expect(spyTestObserver).toHaveBeenCalledWith<TestObserver[]>("UPDATE_BIO");
  // 👇 check editing attributes
  bioInput = screen.getByTestId("bio-input");
  bioUpdate = screen.queryByTestId("bio-update");
  bioSave = screen.queryByTestId("bio-save");
  expect(bioInput).not.toHaveAttribute("contenteditable", "true");
  expect(bioUpdate).toBeVisible();
  expect(bioSave).toBeNull();
};

const toggleNotification = async (
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>
) => {
  let toggle = "slategray";
  // 👇 notification switch
  const notificationSwitch = screen.getByTestId("notification-switch");
  if (notificationSwitch.style.backgroundColor === toggle) {
    toggle = "orangered";
  }
  // 👇 clean up a mock's usage data between assertions
  spyTestObserver.mockClear();
  // 👇 trigger notification toggle
  fireEvent.click(notificationSwitch);
  // 👇 check switch style
  await wait(() => {
    // 👇 notification toggle mutation should have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(1);
    expect(spyTestObserver).toHaveBeenCalledWith<TestObserver[]>(
      "NOTIFICATION_TOGGLE"
    );
    expect(notificationSwitch).toHaveStyle({
      "background-color": toggle,
    });
  });
};

const fetchCalls = async (
  spyTestObserver: jest.SpyInstance<void, [status: TestObserver]>,
  pages: number
) => {
  // 👇 fetch posts calls
  const calls = spyTestObserver.mock.calls;
  expect(testObserverCount(calls, "FETCH")).toEqual(1);
  expect(testObserverCount(calls, "FETCH_MORE")).toEqual(pages + 1);
  await wait(() => {
    // 👇 last call for no data is called twice
    expect(testObserverCount(calls, "FETCH_MORE_FINAL")).toEqual(2);
  });
};

const getFollowButton = (user: UserType) =>
  screen.queryByTestId(`follow-${user.auth}-${user.username}`);

const getMutualText = (user: UserType) =>
  screen.queryByTestId(`mutual-${user.auth}-${user.username}`);

describe("User Posts", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render component", async () => {
    await renderHelper("getUserPosts", trueFalse);
  });

  it("should render all posts created by user", async () => {
    await renderSelection("getUserPosts", "posts");
  });

  it("should render all user comments", async () => {
    await renderSelection("getUserComments", "replies");
  });

  it("should render all user posts with media", async () => {
    await renderSelection("getUserMedias", "media");
  });

  it("should render all posts liked by user", async () => {
    await renderSelection("getUserLikes", "likes");
  });
});

describe("User Followers", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should render user followers", async () => {
    await renderSelection("getFollowers", "followers");
  });

  it("should render all users the unauthenticated user is following", async () => {
    await renderSelection("getFollowing", "following", false, false);
  });

  it("should render all mutual users the authenticated user is following", async () => {
    await renderSelection("getFollowing", "following", true, true);
  });

  it("should render all non mutual users the authenticated user is following", async () => {
    await renderSelection("getFollowing", "following", true, false);
  });

  it("should render all followers of the unauthenticated user", async () => {
    await renderSelection("getFollowers", "followers", false, false);
  });

  it("should render all mutual followers of the authenticated user", async () => {
    await renderSelection("getFollowers", "followers", true, true);
  });

  it("should render all non mutual followers of the authenticated user", async () => {
    await renderSelection("getFollowers", "followers", true, false);
  });

  it("should unfollow and follow a following user ", async () => {
    const query = "getFollowing";
    // 👇 render following mutuals
    const { postsOrUsers, spyTestObserver } = await renderSelection(
      query,
      "following",
      true,
      true
    );
    const firstUser = postsOrUsers[0].result.data[query][0] as UserType;
    await testFollowButton(spyTestObserver, firstUser);
  });

  it("should unfollow and follow a follower", async () => {
    const query = "getFollowers";
    // 👇 render mutual followers
    const { postsOrUsers, spyTestObserver } = await renderSelection(
      query,
      "followers",
      true,
      true
    );
    const firstUser = postsOrUsers[0].result.data[query][0] as UserType;
    await testFollowButton(spyTestObserver, firstUser);
  });

  it("should get follow status for a mutual", async () => {
    const getUser = createUserType();
    const authUser = createUserType();
    const status: Follow = {
      followers: 1,
      following: 1,
    };
    const { spyTestObserver } = await renderHelper("getUserPosts", [true], {
      getUser,
      authUser,
      status,
    });
    await testFollowButton(spyTestObserver, getUser, status);
  });

  it("should get follow status for a follower", async () => {
    const getUser = createUserType();
    const authUser = createUserType();
    const status: Follow = {
      followers: 1,
      following: 0,
    };
    const { spyTestObserver } = await renderHelper("getUserPosts", [true], {
      getUser,
      authUser,
      status,
    });
    await testFollowButton(spyTestObserver, getUser, status);
  });

  it("should get follow status for a following user", async () => {
    const getUser = createUserType();
    const authUser = createUserType();
    const status: Follow = {
      followers: 0,
      following: 1,
    };
    const { spyTestObserver } = await renderHelper("getUserPosts", [true], {
      getUser,
      authUser,
      status,
    });
    await testFollowButton(spyTestObserver, getUser, status);
  });
});

describe("User Attributes Update", () => {
  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should update user avatar", async () => {
    const { spyAxiosPost, spyTestObserver, authInput } = await renderHelper(
      "getUserPosts",
      [true]
    );
    // 👇 profile update icon
    const profileUpdate = screen.getByText(findByClass("update"));
    // 👇 get upload input
    let upload = screen.getByText<HTMLInputElement>(findInputFileElement);
    expect(upload).toHaveAttribute("hidden", "");
    // 👇 check progress indicators before upload
    let imageContainer = screen.getByTestId("profile-header");
    const loader = imageContainer.querySelector(".loader") as HTMLDivElement;
    const percent = imageContainer.querySelector(".percent") as HTMLSpanElement;
    expect(profileUpdate).toHaveStyle(flexDisplay);
    expect(loader).toHaveStyle(flexDisplay);

    // 👇 profile image
    const profile = screen.getByText(
      findMediaElement(helpers.avatarUrl(authInput.username, authInput.auth))
    );
    // 👇 simulate load event for image
    fireEvent.load(profile);
    // 👇 loading spinner should be hidden
    await wait(() => {
      expect(loader).toHaveStyle(noDisplay);
    });
    expect(percent).toHaveTextContent("");
    // 👇 mock success upload post request
    spyAxiosPost.mockImplementationOnce(
      (url: string, data: unknown, config?: AxiosRequestConfig) => {
        // 👇 check progress indicators at start of upload
        expect(profileUpdate).toHaveStyle(noDisplay);
        expect(loader).toHaveStyle(flexDisplay);
        expect(percent).toHaveTextContent("0 %");
        // 👇 this mocks a request which is always at 50% progress
        mockUploadProgress(config);
        return Promise.resolve({});
      }
    );
    // 👇 create test image of a valid size (1 MB)
    const name = "file.jpg";
    const type = "image/jpg";
    let file = createFile(name, type, 1);
    // 👇 clean up a mock's usage data between assertions
    spyTestObserver.mockClear();
    // 👇 simulate file change which triggers file upload
    await changeFile(upload, file);
    await wait(() => {
      // 👇 uploaded image url should have been updated
      expect(spyTestObserver).toHaveBeenCalledTimes(1);
      expect(spyTestObserver).toHaveBeenCalledWith<TestObserver[]>(
        "UPDATE_AVATAR"
      );
    });
    await loadImage({
      update: profileUpdate,
      loader,
      profile,
      percent,
      progress: "50 %",
    });

    // 👇 TEST POST WITH IMAGE EXCEEDING MAXIMUM UPLOAD LIMIT

    // 👇 clean up a mock's usage data between assertions
    spyTestObserver.mockClear();
    // 👇 mock error upload post request
    const error = await errorChangeFile(name, type, spyAxiosPost);
    // 👇 error text display should be visible
    const errorElement = await screen.findByText(findErrorText(error));
    expect(errorElement).toBeVisible();
    // 👇 uploaded image url should not have been called
    expect(spyTestObserver).toHaveBeenCalledTimes(0);
    await loadImage({
      update: profileUpdate,
      loader,
      profile,
      percent,
      progress: "0 %",
    });
  });

  it("should update user bio", async () => {
    const bio = {
      body: "I updated my bio.",
      error: "User not authenticated.",
    };
    const { spyTestObserver } = await renderHelper("getUserPosts", [true], {
      bio,
    });

    // 👇 error text display should not exist
    const errorElement = screen.queryByText(findErrorText(bio.error));
    expect(errorElement).toBeNull();

    await updateBio(spyTestObserver, "__error__", bio.error);
    await updateBio(spyTestObserver, bio.body);
  });

  it("should update notification switch", async () => {
    const { spyTestObserver } = await renderHelper("getUserPosts", [true], {
      toggle: true,
    });
    await toggleNotification(spyTestObserver);
  });
});
