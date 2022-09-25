// 👇 React Testing
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// 👇 React Router
import Router from "react-router-dom";
// 👇 Pages
import PostDetails from "../../pages/PostDetails";
// 👇 Components
import MockProvider from "../../__mocks__/components/MockProvider";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { PostType, UserType } from "../../utils/types";
import { Mocks } from "../../__mocks__/utils/types";
import { usersFound } from "../../__mocks__/utils/constants";
import {
  mockIntersectionObserver,
  generatePosts,
  testObserverCount,
  createAuth,
  createPost,
  mockMutations,
  findTextContent,
  wait,
  generatePost,
  viewAllComments,
  createUserType,
  findByClass,
  generateFindUsers,
  testUser,
  testAttachment,
  mockAvatarUrl,
  testPostElement,
  mockMatchMedia,
} from "../../__mocks__/utils/helpers";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
}));

// 👇 user handle search hint
const findHint = "f";

const renderComponent = async (
  mocks: Mocks,
  commentsCounts: number,
  post: PostType,
  authUser?: UserType
) => {
  const spyTestObserver = jest.spyOn(helpers, "testObserver");
  const type = post.parent ? "reply" : "post";
  jest.spyOn(Router, "useParams").mockReturnValue({
    [`${type}Id`]: post.id,
  });
  // 👇 mock avatar url for consistent value in DOM testing
  jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  // 👇 IntersectionObserver isn't available in test environment;
  mockIntersectionObserver();

  mocks = mocks || [];
  // 👇 mock response for user authentication
  if (authUser) {
    mocks.push(createAuth(true, authUser));
  } else {
    mocks.push(createAuth(false));
  }

  render(
    <MockProvider mocks={mocks}>
      <PostDetails />
    </MockProvider>
  );

  await wait(() => {
    // 👇 check posts
    const queryPosts = screen.queryAllByTestId(/^post-/);
    // 👇 check comments
    const queryComments = screen.queryAllByTestId(/^reply-/);
    // 👇 check title
    const title = screen.getByText(findTextContent(`✍︎ ${type}`));
    expect(title).toBeVisible();
    if (type === "post") {
      expect(queryPosts).toHaveLength(1);
      expect(queryComments).toHaveLength(commentsCounts);
    } else {
      expect(queryPosts).toHaveLength(0);
      expect(queryComments).toHaveLength(1 + commentsCounts);
    }
  });
  if (type === "post") {
    // 👇 test post element
    testPostElement(post, true);
  }
  // 👇 test post input control
  testAttachment(post.id, "Write a reply...", authUser);

  return {
    spyTestObserver,
  };
};

const renderHelper = async (
  args?: Partial<{ parent: PostType; authUser: UserType }>
) => {
  const commentsCounts = 3;
  const commentsPages = 5;
  const stats = {
    comments: commentsCounts * commentsPages,
    liked: 0,
    likes: 0,
  };
  // 👇 parent post for comments
  const getPost = generatePost(stats, {
    parent: args?.parent,
  });
  // 👇 generate post with parent
  const getPosts = generatePosts(commentsCounts, commentsPages, {
    parent: {
      id: getPost.post.id,
      stats,
    },
  });
  const findUsers = generateFindUsers(findHint, usersFound);
  // 👇 defining mocked responses
  const mocks = [
    // 👇 'getPosts' twice as 'comment icon' may be clicked which will fetch again after the initial fetch
    ...getPosts,
    ...getPosts,
    getPost.response,
    mockMutations.likePost(getPost.post.id),
    mockMutations.unLikePost(getPost.post.id),
    findUsers.response,
  ];
  // 👇 render and test component
  const { spyTestObserver } = await renderComponent(
    mocks,
    commentsCounts,
    getPost.post,
    args?.authUser
  );

  // 👇 likes icon should be visible
  const likeIcon = screen.getByTestId(`likeIcon-${getPost.post.id}`);
  expect(likeIcon).toBeVisible();
  expect(Number(likeIcon.textContent)).toEqual(getPost.post.stats.likes);

  await viewAllComments(
    getPost.post,
    commentsCounts,
    commentsPages,
    stats.comments,
    args?.parent ? "reply" : "post"
  );

  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 get post and reply calls
  expect(testObserverCount(calls, "GET_POST")).toEqual(1);
  expect(testObserverCount(calls, "GET_POSTS")).toEqual(commentsPages + 1);

  return {
    spyTestObserver,
    post: getPost.post,
    users: findUsers.users,
  };
};

describe("Post Details", () => {
  beforeAll(() => {
    mockMatchMedia();
  });

  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("should display a post with comments", async () => {
    await renderHelper();
  });

  it("should display a comment with comments", async () => {
    await renderHelper({
      parent: createPost(),
    });
  });

  it("should like and unlike a post", async () => {
    // 👇 fake timers for manually advancing intervals
    jest.useFakeTimers();
    const { post, spyTestObserver } = await renderHelper();
    // 👇 liked heart should not exist
    const likedHeart = screen.queryByTestId(`likeIcon-${post.id}-liked`);
    expect(likedHeart).toBeNull();
    // 👇 simulate clicking to like post
    let likeIcon = screen.getByTestId(`likeIcon-${post.id}`);
    fireEvent.click(likeIcon);
    await wait(async () => {
      // 👇 liked animation should be visible
      const likeAnimation = screen.getByTestId(`likeAnimation-${post.id}`);
      expect(likeAnimation).toBeVisible();
      // 👇 simulate loading animation
      fireEvent.load(likeAnimation);
      // 👇 advance timer to update likes count and hide animation
      jest.advanceTimersByTime(helpers.secsToMs(2));
      await wait(() => {
        // 👇 liked animation should not exist
        const likeAnimation = screen.queryByTestId(`likeAnimation-${post.id}`);
        expect(likeAnimation).toBeNull();
        // 👇 likes count should have updated
        likeIcon = screen.getByTestId(`likeIcon-${post.id}`);
        expect(likeIcon).toBeVisible();
        expect(Number(likeIcon.textContent)).toEqual(post.stats.likes + 1);
      });
    });
    // 👇 simulate clicking to unlike post
    fireEvent.click(likeIcon);
    await wait(() => {
      // 👇 likes count should have updated
      likeIcon = screen.getByTestId(`likeIcon-${post.id}`);
      expect(likeIcon).toBeVisible();
      expect(Number(likeIcon.textContent)).toEqual(post.stats.likes);
    });
    jest.useRealTimers();

    // 👇 method calls
    const calls = spyTestObserver.mock.calls;
    // 👇 like and unlike calls
    expect(testObserverCount(calls, "LIKE_POST")).toEqual(1);
    expect(testObserverCount(calls, "UNLIKE_POST")).toEqual(1);
  });

  it("should show emoji keyboard", async () => {
    await renderHelper({
      authUser: createUserType(),
    });
    // 👇 emoji icon should be visible
    const emojiIcon = screen.getByText(
      findByClass("react-input-emoji--button", "button")
    );
    expect(emojiIcon).toBeVisible();
    // 👇 simulate clicking to show emoji keyboard
    fireEvent.click(emojiIcon);
    await wait(() => {
      // 👇 get 'thumbs up' emoji
      const thumbsUp = screen.getAllByLabelText("👍, +1, thumbsup");
      expect(thumbsUp.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should update input with the username from the handle search results", async () => {
    const { users } = await renderHelper({
      authUser: createUserType(),
    });

    const handle = "@" + findHint;
    const replyInput = screen.getByPlaceholderText("Write a reply...");
    // 👇 check users
    let queryUsers = screen.queryAllByTestId(/^find-user-/);
    expect(queryUsers).toHaveLength(0);
    // 👇 simulate typing user handle
    userEvent.type(replyInput, handle);
    await wait(() => {
      // 👇 input value should have changed
      expect(replyInput).toHaveValue(handle);
      // 👇 should have retrieved found users
      queryUsers = screen.getAllByTestId(/^find-user-/);
      expect(queryUsers).toHaveLength(usersFound);
    });
    // 👇 test users
    users.forEach((user) => {
      testUser(user, false);
    });

    // 👇 simulate clicking on first user found
    const user = queryUsers[0];
    fireEvent.click(user);
    await wait(() => {
      // 👇 input value should have changed to the username from the search result
      expect(replyInput).toHaveValue("@" + users[0].username);
    });
  });
});
