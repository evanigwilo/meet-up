// 👇 React Testing
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
// 👇 Pages
import Home from "../../pages/Home";
// 👇 Services
import axios from "../../services/axios";
// 👇 Components
import MockProvider from "../../__mocks__/components/MockProvider";
// 👇 Constants, Helpers & Types
import * as helpers from "../../utils/helpers";
import { PostType, UserType } from "../../utils/types";
import { Mocks } from "../../__mocks__/utils/types";
import { uploadId } from "../../__mocks__/utils/constants";
import {
  mockIntersectionObserver,
  generatePosts,
  testObserverCount,
  createAuth,
  createPost,
  mockMutations,
  resolved,
  findTextContent,
  wait,
  testPostElement,
  createUserType,
  viewAllComments,
  mockAvatarUrl,
  mockObjectURL,
  testAttachment,
  loadFileForSuccessfulUpload,
  loadFileForFailedUpload,
  testNoRemoveOrMediaElement,
  testFailedUpload,
  testMediaElement,
  typeInput,
  sendInput,
  mockMatchMedia,
} from "../../__mocks__/utils/helpers";
import { trends } from "../../utils/constants";

const renderComponent = async (
  mocks: Mocks,
  postCount: number,
  postPages: number,
  postGenerated: ReturnType<typeof generatePosts>,
  authUser?: UserType
) => {
  const spyTestObserver = jest.spyOn(helpers, "testObserver");
  const spySleep = jest.spyOn(helpers, "sleep").mockImplementation(resolved);
  // 👇 spy on scroll to
  const spyScrollTo = jest.spyOn(window, "scrollTo").mockImplementation();
  const spyAxiosPost = jest.spyOn(axios, "post");
  const spyPause = jest
    .spyOn(window.HTMLMediaElement.prototype, "pause")
    .mockImplementation();
  // 👇 mock avatar url for consistent value in DOM testing
  jest.spyOn(helpers, "avatarUrl").mockImplementation(mockAvatarUrl);
  mockObjectURL();
  // 👇 IntersectionObserver isn't available in test environment;
  mockIntersectionObserver();

  // 👇 makes sure all updates related to these “units” have been processed and applied to the DOM before you make any assertions
  /*
    await act(async () => {

    });
  */

  mocks = mocks || [];
  // 👇 mock response for user authentication
  if (authUser) {
    mocks.push(createAuth(true, authUser));
  } else {
    mocks.push(createAuth(false));
  }

  render(
    <MockProvider mocks={mocks}>
      <Home />
    </MockProvider>
  );

  await wait(() => {
    // 👇 finished pagination
    const finished = screen.getByText(findTextContent("Finished."));
    expect(finished).toBeVisible();
    // 👇 show newer posts
    const morePosts = screen.getByTestId("newPosts");
    expect(morePosts).toBeVisible();
  });

  // 👇 check posts
  const queryPosts = screen.queryAllByTestId(/^post-/);
  expect(queryPosts).toHaveLength(postCount * postPages);
  // 👇 check comments
  const queryComments = screen.queryAllByTestId(/^reply-/);
  expect(queryComments).toHaveLength(0);
  // 👇 test each post element
  postGenerated.forEach((pages) => {
    pages.result.data.getPosts.forEach((post) => {
      testPostElement(post);
    });
  });
  // 👇 check trends
  const queryTrends = screen.queryAllByTestId(/^trends-/);
  expect(queryTrends).toHaveLength(trends.length);
  trends.forEach((trend) => {
    const trendElement = screen.getByTestId(`trends-${trend}`);
    expect(trendElement).toBeInTheDocument();
  });

  testAttachment("post", "What’s happening?", authUser);

  // 👇 set post counter and hide modal (2)
  expect(spySleep).toBeCalledTimes(2);
  // 👇 method calls
  const calls = spyTestObserver.mock.calls;
  // 👇 ws connection only if user is authenticated
  expect(testObserverCount(calls, "WS_OPEN")).toEqual(authUser ? 1 : 0);
  expect(testObserverCount(calls, "HIDE_MODAL")).toEqual(1);
  expect(testObserverCount(calls, "SET_POST_COUNTER")).toEqual(1);
  // 👇 fetch posts calls
  expect(testObserverCount(calls, "FETCH")).toEqual(1);
  expect(testObserverCount(calls, "FETCH_MORE")).toEqual(postPages + 1);
  await wait(() => {
    // 👇 authentication calls twice for socket and context providers
    expect(testObserverCount(calls, "AUTHENTICATION")).toEqual(2);
    // 👇 last call for no data is called twice
    expect(testObserverCount(calls, "FETCH_MORE_FINAL")).toEqual(
      postPages ? 2 : 1
    );
  });
  // 👇 no page scroll
  expect(spyScrollTo).toHaveBeenCalledTimes(0);

  return {
    spyTestObserver,
    spySleep,
    spyPause,
    spyScrollTo,
    spyAxiosPost,
  };
};

const typePostInput = async (post: PostType) => {
  // 👇 the post to be created should not be in document
  const findPost = screen.queryByTestId(`post-${post.id}`);
  expect(findPost).toBeNull();
  await typeInput("What’s happening?", post);
};

const sendPost = async (post: PostType | string) => {
  await sendInput("What’s happening?", post, async () => {
    // 👇 check if post element matches the created post
    testPostElement(post as PostType);
  });
};

describe("Home", () => {
  beforeAll(() => {
    mockMatchMedia();
  });

  afterEach(() => {
    // 👇 unmounts react trees that were mounted with render.
    cleanup();
  });

  it("displays paginated posts", async () => {
    const postCount = 5;
    const postPages = 2;
    const getPosts = generatePosts(postCount, postPages);
    const mocks = [...getPosts];
    // 👇 render and test component
    await renderComponent(
      mocks,
      postCount,
      postPages,
      getPosts,
      createUserType()
    );
  });

  it("displays posts with reply threads", async () => {
    const postCount = 1;
    const postPages = 1;
    const commentsCounts = 3;
    const commentsPages = 5;

    const getParent = generatePosts(postCount, postPages);
    // 👇 parent post for comments
    const parent = getParent[0].result.data.getPosts[0];
    const stats = {
      comments: commentsCounts * commentsPages,
      liked: 1,
      likes: 10,
    };
    // 👇 generate post with parent
    const getPosts = generatePosts(commentsCounts, commentsPages, {
      parent: {
        id: parent.id,
        stats,
      },
    });
    // 👇 defining mocked responses
    const mocks = [...getParent, ...getPosts];
    // 👇 render and test component
    await renderComponent(mocks, postCount, postPages, getParent);
    // 👇 likes icon should be visible
    const likeIcon = screen.getByTestId(`likeIcon-${parent.id}`);
    expect(likeIcon).toBeVisible();
    expect(Number(likeIcon.textContent)).toEqual(parent.stats.likes);

    await viewAllComments(
      parent,
      commentsCounts,
      commentsPages,
      stats.comments
    );
  });

  it("displays newer posts", async () => {
    const postCount = 0;
    const postPages = 0;
    const getPosts = generatePosts(postCount, postPages);
    // 👇 defining mocked responses
    const mocks = [...getPosts];
    // 👇 render and test component
    await renderComponent(mocks, postCount, postPages, getPosts);
    // 👇 no post after render
    let queryPosts = screen.queryAllByTestId(/^post-/);
    expect(queryPosts.length).toEqual(0);
    const morePosts = screen.getByTestId("newPosts");
    // 👇 simulate clicking on getting newer post
    fireEvent.click(morePosts);
    // 👇 check posts is loaded
    queryPosts = await screen.findAllByTestId(/^post-/);
    expect(queryPosts.length).toBeGreaterThan(0);
  });

  it("should create a post", async () => {
    const postCount = 0;
    const postPages = 0;
    const getPosts = generatePosts(postCount, postPages);
    const mockPost = createPost();
    const error = "Body shouldn't be empty.";
    // 👇 defining mocked responses for creating post successfully and with error
    const mocks = [
      ...getPosts,
      mockMutations.createPost({ ...mockPost, body: "" }, error),
      mockMutations.createPost(mockPost),
    ];
    // 👇 render and test component
    await renderComponent(
      mocks,
      postCount,
      postPages,
      getPosts,
      createUserType()
    );

    // 👇 type in post input
    await typePostInput(mockPost);
    // 👇 send the post with body
    await sendPost(mockPost);
    // 👇 send the post with no body
    await sendPost(error);
  });

  it("should create a post with media", async () => {
    const postCount = 0;
    const postPages = 0;
    const getPosts = generatePosts(postCount, postPages);
    const type = "image/jpg";
    const name = "file.jpg";
    const tag = "img";
    const mockPost = createPost({
      id: uploadId,
      media: type,
    });
    // 👇 defining mocked responses for creating post
    const mocks = [...getPosts, mockMutations.createPost(mockPost)];
    // 👇 render and test component
    const { spyAxiosPost, spyScrollTo } = await renderComponent(
      mocks,
      postCount,
      postPages,
      getPosts,
      createUserType()
    );
    // 👇 type in post input
    await typePostInput(mockPost);

    await loadFileForSuccessfulUpload({
      attachmentId: "post",
      name,
      tag,
      spyAxiosPost,
      type,
    });

    // 👇 send the post
    await sendPost(mockPost);
    // 👇 media & remove element should not exist
    testNoRemoveOrMediaElement(tag);
    // 👇 check page scroll
    expect(spyScrollTo).toHaveBeenCalled();

    // 👇 TEST POST WITH MEDIA EXCEEDING MAXIMUM UPLOAD LIMIT
    const error = await loadFileForFailedUpload({
      name,
      tag,
      spyAxiosPost,
      type,
    });

    // 👇 send the post with upload limit error
    await sendPost(error);
    await testFailedUpload("post", tag);
  });

  it("should pause all other playing media when a media is played", async () => {
    // 👇 2 posts with media
    const postCount = 2;
    const postPages = 1;
    const getPosts = generatePosts(postCount, postPages, {
      media: true,
    });
    // 👇 defining mocked responses for creating post
    const mocks = [...getPosts];
    // 👇 render and test component
    const { spyPause } = await renderComponent(
      mocks,
      postCount,
      postPages,
      getPosts
    );
    // 👇 get the posts
    const posts = getPosts[0].result.data.getPosts;
    // 👇 play both medias
    for (const post of posts) {
      // 👇 check if post element matches the post
      testPostElement(post);
      const mediaElement = await testMediaElement(
        "source",
        helpers.mediaUrl("post", post.id, post.media)
      );
      // 👇 trigger a media to play
      fireEvent.play(mediaElement!);
    }
    // 👇 both media should have been paused
    await wait(() => {
      expect(spyPause).toHaveBeenCalledTimes(2);
    });
  });
});
