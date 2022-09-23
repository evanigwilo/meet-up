// 👇 React Testing
import userEvent from "@testing-library/user-event";
import { screen, waitFor, fireEvent } from "@testing-library/react";
// 👇 Apollo & Graphql
import { DocumentNode } from "@apollo/client";
import { GraphQLError } from "graphql/error";
// 👇 Services
import { AxiosError, AxiosRequestConfig } from "axios";
import dayjs from "../../services/dayjs";
// 👇 Faker
import { faker } from "@faker-js/faker";
// 👇 Constants, Helpers & Types
import { Tag } from "./types";
import { AuthType, Gender } from "../../utils/types/enum";
import { gqlMutations, gqlSubscriptions } from "../../utils/constants";
import { testTime } from "../../__mocks__/utils/constants";
import {
  disabledElement,
  enabledElement,
  objectUrl,
  testDate,
  testHandles,
  uploadId,
  usersFound,
} from "./constants";
import {
  TestObserver,
  UserType,
  UserSub,
  PostType,
  KeyValue,
  AuthCredentials,
  AuthInput,
  GqlQueries,
  Follow,
  NotificationType,
  ConversationsType,
  MessageType,
  ReactionType,
  ConversationType,
  ReactedType,
  ReactionKeys,
  MessageInput,
} from "../../utils/types";
import {
  authPath,
  avatarUrl,
  formatStats,
  gqlQuery,
  isMimeType,
  mediaUrl,
  randomNumber,
  secsToMs,
  uniqueId,
} from "../../utils/helpers";

export const resolved = () => Promise.resolve();

export const axiosError = (data: any) => {
  const response: Partial<AxiosError["response"]> = { data };
  return {
    response,
  };
};

export const axiosData = <T>(data: T) => ({ data });

export const testObserverCount = (
  array: [status: TestObserver][],
  find: TestObserver
) => {
  return array.reduce(
    (count, item) => (item[0] === find ? count + 1 : count),
    0
  );
};

export const testErrorExtensions = (firstPage: { errors: GraphQLError[] }) => {
  // 👇 error text display should exist
  const errorElement = screen.getByText(
    findErrorText(firstPage.errors[0].extensions.getConversations as string)
  );
  expect(errorElement).toBeVisible();
};

export const testPostElement = (post: PostType, postDetail = false) => {
  // 👇 the created post should in document
  const category = post.parent ? "reply" : "post";
  const findPost = screen.getByTestId(`${category}-${post.id}`);
  expect(findPost).toBeVisible();
  // 👇 body
  const body = screen.getByText(findTextContent(post.body));
  expect(body).toBeVisible();
  // 👇 username
  const username = screen.getByText(
    findTextContent("@" + post.createdBy.username)
  );
  expect(username).toBeVisible();

  // 👇 created date
  const createdDate = screen.getByTestId(`createdDate-${post.id}`);
  expect(createdDate).toBeVisible();
  expect(createdDate).toHaveTextContent(
    dayjs(Number(post.createdDate)).fromNow()
  );
  // 👇 profile
  const profile = screen.getByText(
    findMediaElement(avatarUrl(post.createdBy.id))
  );
  expect(profile).toBeVisible();
  // 👇 media
  const tag = isMimeType("image", post.media) ? "img" : "source";
  const media = screen.queryByText(
    findMediaElement(mediaUrl(category, post.id, post.media), tag)
  );
  if (post.media) {
    expect(media).toBeInTheDocument();
  } else {
    expect(media).toBeNull();
  }
  // 👇 like icon
  const like = screen.getByTestId(`likeIcon-${post.id}`);
  expect(like).toBeVisible();
  expect(like).toHaveTextContent(formatStats(post.stats.likes).toString());
  // 👇 liked post
  const liked = screen.queryByTestId(`likeIcon-${post.id}-liked`);
  if (post.stats.liked) {
    expect(liked).toBeVisible();
  } else {
    expect(liked).toBeNull();
  }
  // 👇 comments icon
  const comment = screen.getByTestId(`commentIcon-${post.id}`);
  expect(comment).toBeVisible();
  expect(comment).toHaveTextContent(
    formatStats(post.stats.comments).toString()
  );
  // 👇 share icon
  const share = screen.getByTestId(`shareIcon-${post.id}`);
  expect(share).toBeVisible();
  // 👇 open in new tab icon
  /*
   const tab = screen.getByTestId(`newTab-${post.id}`);
  */
  const tab = screen.queryByText(
    findByAttribute("a", "href", `/${category}/${post.id}`)
  );
  if (postDetail) {
    expect(tab).toBeNull();
  } else {
    expect(tab).toHaveAttribute("target", "_blank");
    expect(tab).toBeVisible();
  }
};

export const testAttachment = (
  attachmentId: string,
  placeholderText: string,
  authUser?: UserType
) => {
  const attachment = screen.queryByTestId(`attachment-${attachmentId}`);
  if (!authUser) {
    // 👇 no attachment if user is unauthenticated
    expect(attachment).toBe(null);
  } else {
    // 👇 create attachment should be visible if user is authenticated
    expect(attachment).toBeVisible();
    // 👇 check text avatar
    const avatar = attachment?.querySelector("img");
    expect(avatar).toHaveAttribute("src", avatarUrl(authUser.id));
    // 👇 check text input
    const input = screen.getByPlaceholderText(placeholderText);
    expect(input).toBeVisible();
    expect(input).toHaveValue("");
    // 👇 check media attachment icon
    const media = screen.getByTestId(`attachment-${attachmentId}-media-change`);
    expect(media).toBeVisible();
  }
};

// 👇 check user
export const testUser = (user: UserType | UserSub, nameLink: boolean) => {
  // 👇 profile
  const profile = screen.getByText(findMediaElement(avatarUrl(user.id)));
  expect(profile).toBeVisible();
  // 👇 username
  const username = screen.getByText(findTextContent("@" + user.username));
  expect(username).toBeVisible();
  // 👇 name
  const name = screen.getByText(
    nameLink
      ? findByAttribute("a", "href", authPath(user))
      : findTextContent(user.name)
  );
  expect(name).toBeVisible();
  expect(name).toHaveTextContent(user.name);
};

export const testHandleSearch = async (
  placeholder: string,
  users: UserSub[],
  link = false
) => {
  // 👇 'find user' search bar
  const findUser = screen.getByPlaceholderText(placeholder);
  expect(findUser).toHaveValue("");
  // 👇 check users
  let queryUsers = screen.queryAllByTestId(/^find-user-/);
  expect(queryUsers).toHaveLength(0);

  // 👇 simulate typing a non-existing user handle
  userEvent.type(findUser, testHandles.none);
  await wait(() => {
    // 👇 input value should have changed
    expect(findUser).toHaveValue(testHandles.none);
    // 👇 should have no users
    queryUsers = screen.queryAllByTestId(/^find-user-/);
    expect(queryUsers).toHaveLength(0);
    // 👇 'user not found' should be shown
    const noUser = screen.getByText(findTextContent("No user found."));
    expect(noUser).toBeVisible();
  });

  // 👇 simulate clearing input field
  userEvent.clear(findUser);
  await wait(() => {
    // 👇 input value should have changed
    expect(findUser).toHaveValue("");
    // 👇 should have no users
    queryUsers = screen.queryAllByTestId(/^find-user-/);
    expect(queryUsers).toHaveLength(0);
  });

  // 👇 simulate typing user handle
  userEvent.type(findUser, testHandles.find);
  await wait(() => {
    // 👇 input value should have changed
    expect(findUser).toHaveValue(testHandles.find);
    // 👇 should have retrieved found users
    queryUsers = screen.getAllByTestId(/^find-user-/);
    expect(queryUsers).toHaveLength(usersFound);
  });
  // 👇 test users
  users.forEach((user) => {
    testUser(user, false);
  });
  // 👇 test row as links
  if (link) {
    queryUsers.forEach((element, index) =>
      expect(element.firstChild).toHaveAttribute("href", authPath(users[index]))
    );
  }
};

export const testFailedUpload = async (attachmentId: string, tag: Tag) => {
  // 👇 remove media icon should be active
  const remove = screen.getByText(findCloseElement);
  expect(remove).toHaveStyle(enabledElement);
  // 👇 simulate removing media
  fireEvent.click(remove);
  await wait(async () => {
    const mediaViewer = screen.getByTestId(
      `attachment-${attachmentId}-media-file`
    );
    // 👇 trigger media 'transitionEnd' event to close media
    fireEvent.transitionEnd(mediaViewer);
    await wait(() => {
      // 👇 media & remove element should not exist
      testNoRemoveOrMediaElement(tag);
    });
  });
};

export const testMediaElement = async (tag: Tag, src: string) => {
  // 👇 media element should not be visible
  const mediaElement = getMediaElement(tag, src);
  expect(mediaElement).toBeInTheDocument();
  expect(mediaElement).not.toBeVisible();
  // 👇 simulate load event if image or playable media
  if (tag === "source") {
    fireEvent.loadedMetadata(mediaElement!);
  } else {
    fireEvent.load(mediaElement!);
  }
  // 👇 check media visibility
  await wait(() => {
    expect(mediaElement).toBeVisible();
  });

  return mediaElement;
};

export const testNoRemoveOrMediaElement = (tag: Tag) => {
  // 👇 media element should not exist
  const mediaElement = getMediaElement(tag, objectUrl);
  // 👇 remove media icon should not exist
  const remove = screen.queryByText(findCloseElement);
  expect(mediaElement || remove).toBeNull();
};

export const findTextContent =
  (text: string, tag = "span") =>
  (content: string, element: Element | null) =>
    // 👇 'textContent' checks newline (\n)
    element?.tagName.toLowerCase() === tag && element.textContent === text;

export const findMediaElement =
  (src: string, tag: Tag = "img") =>
  (content: string, element: Element | null) =>
    element?.tagName.toLowerCase() === tag &&
    element.getAttribute("src") === src;

export const findCloseElement = (content: string, element: Element | null) =>
  Boolean(
    element?.firstElementChild?.textContent === "✕" &&
      element.firstElementChild.tagName.toLowerCase() === "span" &&
      element.children.length === 1 &&
      !element.getAttribute("data-testid")
  );

export const findErrorText =
  (contains: string) => (content: string, element: Element | null) =>
    Boolean(
      element?.tagName.toLowerCase() === "span" &&
        element.classList.contains("error") &&
        content.includes(contains)
    );

export const findByClass =
  (contains: string, tag = "div") =>
  (content: string, element: Element | null) =>
    element?.tagName.toLowerCase() === tag &&
    element.classList.contains(contains);

export const findByAttribute =
  (tag: string, attribute: string, value: string) =>
  (content: string, element: Element | null) =>
    element?.tagName.toLowerCase() === tag &&
    element.getAttribute(attribute) === value;

export const findInputFileElement = findByAttribute("input", "type", "file");

// 👇 waitFor helper for waiting for assertion to be satisfied before proceeding
export const wait = async (callback: () => void, timeout = 5) => {
  await waitFor(() => callback(), {
    timeout: secsToMs(timeout),
  });
};

export const changeFile = async (upload: HTMLInputElement, file: File) => {
  // 👇 change image file
  userEvent.upload(upload, file);
  // 👇 check uploaded file properties
  await wait(() => {
    expect(upload.files).toHaveLength(1);
    const uploadFile = upload.files?.[0];
    expect(uploadFile?.name).toEqual(file.name);
    expect(uploadFile?.size).toEqual(file.size);
    expect(uploadFile?.type).toEqual(file.type);
  });
};

// 👇 file create helper with size definition in megabytes (MB)
export const createFile = (name: string, type: string, size: number) => {
  const file = new File(/* [buffer] */ ["contents"], name, { type });
  Object.defineProperty(file, "size", {
    value: 1024 * 1024 * size,
    configurable: true,
  });
  return file;
};

export const typeInput = async (
  placeholderText: string,
  type: PostType | MessageType
) => {
  // 👇 check text input
  const input = screen.getByPlaceholderText(placeholderText);
  expect(input).toBeVisible();
  expect(input).toHaveValue("");
  // 👇 simulate typing in input
  userEvent.type(input, type.body!);
  await wait(() => {
    // 👇 input should have body value
    expect(input).toHaveValue(type.body);
  });
};

export const sendInput = async (
  placeholderText: string,
  type: PostType | MessageType | string,
  callback: () => void
) => {
  // 👇 check text input
  const input = screen.getByPlaceholderText(placeholderText);
  expect(input).toBeVisible();
  // 👇 check send button
  const send = screen.getByText(findTextContent("➢"));
  expect(send).toBeVisible();
  if (typeof type === "string") {
    // 👇 simulate clearing in input
    userEvent.clear(input);
    // 👇 error text display should not exist
    let errorElement = screen.queryByText(findErrorText(type));
    expect(errorElement).toBeNull();
    // 👇 simulate clicking on sending
    fireEvent.click(send);
    // 👇 error text display should be visible
    errorElement = await screen.findByText(findErrorText(type));
    expect(errorElement).toBeVisible();
  } else {
    expect(input).toHaveValue(type.body!);
    // 👇 simulate clicking on sending
    fireEvent.click(send);
    await wait(async () => {
      // 👇 check after sending
      await callback();
      // 👇 input should have no value
      expect(input).toHaveValue("");
    });
  }
};

export const loadFileForSuccessfulUpload = async (args: {
  name: string;
  type: string;
  tag: Tag;
  attachmentId: string;
  spyAxiosPost: jest.SpyInstance;
}) => {
  // 👇 get upload input
  const upload = screen.getByText<HTMLInputElement>(findInputFileElement);
  expect(upload).toHaveAttribute("hidden", "");
  // 👇 remove media icon should not exist
  let remove = screen.queryByText(findCloseElement);
  expect(remove).toBeNull();
  /*
      const image = path.join(__dirname, "../../images/", "Lake-Water.jpg");
      const buffer = readFileSync(image);
    */
  // 👇 create test image of a valid size (1 MB)
  const file = createFile(args.name, args.type, 1);
  // 👇 simulate file change
  await changeFile(upload, file);
  // 👇 remove media icon should not be active
  remove = screen.getByText(findCloseElement);
  expect(remove).toHaveStyle(disabledElement);
  // 👇 input controller should not be active
  const attachment = screen.getByTestId(`attachment-${args.attachmentId}`);
  expect(attachment).toHaveStyle({
    "pointer-events": "none",
  });
  await testMediaElement(args.tag, objectUrl);
  // 👇 remove media icon should be active
  expect(remove).toHaveStyle(enabledElement);
  // 👇 input controller should be active
  expect(attachment).toHaveStyle(enabledElement);
  // 👇 check progress indicators before upload
  const mediaViewer = screen.getByTestId(
    `attachment-${args.attachmentId}-media-file`
  );
  const spinner = mediaViewer.querySelector<HTMLDivElement>(".spinner");
  const percent = mediaViewer.querySelector<HTMLSpanElement>(".percent");
  expect(spinner).toHaveClass("spinner hide");
  expect(percent).toHaveTextContent("");
  // 👇 mock success upload request
  args.spyAxiosPost.mockImplementationOnce(
    (url: string, data: unknown, config?: AxiosRequestConfig) => {
      // 👇 check progress indicators at start of upload
      expect(spinner).toHaveClass("spinner show upload progress");
      expect(percent).toHaveTextContent("0 %");
      // 👇 this mocks a request which is always at 50% progress
      mockUploadProgress(config);
      return Promise.resolve(axiosData({}));
    }
  );
};

export const loadFileForFailedUpload = async (args: {
  name: string;
  type: string;
  tag: Tag;
  spyAxiosPost: jest.SpyInstance;
}) => {
  const error = await errorChangeFile(args.name, args.type, args.spyAxiosPost);
  await testMediaElement(args.tag, objectUrl);
  return error;
};

export const getMediaElement = (tag: Tag, src: string) => {
  const mediaSource = screen.queryByText<HTMLImageElement>(
    findMediaElement(src, tag)
  );
  const mediaElement =
    tag === "source" ? mediaSource?.parentElement : mediaSource;

  return mediaElement;
};

export const errorChangeFile = async (
  name: string,
  type: string,
  spyAxiosPost: jest.SpyInstance
) => {
  const error = "File exceeds maximum upload size (1MB).";
  // 👇 mock error upload post request
  spyAxiosPost.mockImplementationOnce(
    (url: string, data: unknown, config?: AxiosRequestConfig) =>
      Promise.reject(axiosError({ message: error }))
  );
  // 👇 define file size exceeding the maximum limit of 1 MB to 2 MB
  const file = createFile(name, type, 2);
  // 👇 get upload input
  const upload = screen.getByText<HTMLInputElement>(findInputFileElement);
  // 👇 error text display should not exist
  const errorElement = screen.queryByText(findErrorText(error));
  expect(errorElement).toBeNull();
  // 👇 simulate file change
  await changeFile(upload, file);

  return error;
};

export const viewAllComments = async (
  post: PostType,
  total: number,
  pages: number,
  commentUpdate: number,
  postDetail?: "post" | "reply"
) => {
  const findViewComments = findTextContent("View more comments");
  // 👇 comments icon should be visible
  let commentIcon = screen.getByTestId(`commentIcon-${post.id}`);
  expect(commentIcon).toBeVisible();
  expect(Number(commentIcon.textContent)).toEqual(post.stats.comments);

  let moreComments = screen.queryByText(findViewComments);
  if (!postDetail) {
    // 👇 'view more comments' option should not exist
    expect(moreComments).toBeNull();
  }
  // 👇 simulate clicking on comments icon to show comments
  fireEvent.click(commentIcon);
  const postIsReply = postDetail === "reply" ? 1 : 0;
  // 👇 simulate clicking 'view more comments' till no more comments to view
  for (let i = 1; i < pages; i++) {
    await wait(() => {
      // 👇 find all comments element in document
      const queryComments = screen.getAllByTestId(/^reply-/);
      expect(queryComments).toHaveLength(total * i + postIsReply);
      // 👇 comments icon should have updated value of total comments after fetching comments
      commentIcon = screen.getByTestId(`commentIcon-${post.id}`);
      expect(Number(commentIcon.textContent)).toEqual(commentUpdate);
      // 👇 'view more comments' option should be visible
      moreComments = screen.queryByText(findViewComments);
      expect(moreComments).toBeVisible();
      // 👇 simulate clicking on 'view more comments' option
      fireEvent.click(moreComments!);
    });
  }
  // 👇 'view more comments' option should not exist after viewing all comments
  moreComments = screen.queryByText(findViewComments);
  expect(moreComments).toBeNull();
};

const createError = (
  query: string,
  error?: string,
  args?: Partial<{
    message: string;
    code: string;
    id: string;
  }>
) => [
  new GraphQLError(args?.message || args?.code || "INPUT_ERROR", {
    extensions: {
      [query]: error,
      code: args?.code || "BAD_USER_INPUT",
      id: args?.id,
    },
    path: [query],
  }),
];

// 👇 mock user authentication response
export const createAuth = (authenticated = true, user?: UserType) => {
  if (user) {
    user.token = user.token || uniqueId();
  }

  return {
    request: {
      query: gqlQuery("auth"),
      variables: {},
    },
    result: authenticated
      ? {
          data: {
            auth:
              user ||
              createUserType({
                token: uniqueId(),
              }),
          },
        }
      : {
          errors: createError("auth", "User not authenticated.", {
            code: "UNAUTHENTICATED",
          }),
        },
  };
};

export const createNotification = (
  type: NotificationType["type"],
  identifier: string,
  args?: Partial<{
    id: string;
    from: UserSub;
    to: UserSub;
    seen: boolean;
    viewed: number;
    createdDate: Date;
  }>
): NotificationType => ({
  id: args?.id || uniqueId(),
  from: args?.from || createUserSub(),
  to: args?.to || createUserSub(),
  seen: args?.seen || false,
  viewed: args?.viewed || 0,
  createdDate: args?.createdDate?.getTime().toString() || testTime,
  identifier,
  type,
});

export const createConversations = (
  args?: Partial<{
    from: UserSub;
    to: UserSub;
    update: boolean;
    unseen: number;
  }>
): ConversationsType => ({
  from: args?.from?.id || uniqueId(),
  to: args?.to?.id || uniqueId(),
  update: args?.update || false,
  unseen: args?.unseen || 0,
});

export const createMessage = (
  type: MessageType["type"],
  args?: Partial<{
    id: string;
    from: Partial<UserSub>;
    to: Partial<UserSub>;
    body: string;
    media: string;
    missed: boolean;
    deleted: boolean;
    reactions: ReactionType[];
    createdDate: Date;
  }>
): MessageType => ({
  id: args?.id || uniqueId(),
  // 👇 The number of words to generate. Defaults to 3.
  body: args?.deleted
    ? null
    : args?.body || faker.helpers.unique(faker.lorem.words),
  media: args?.media || null,
  createdDate: args?.createdDate?.getTime().toString() || testTime,
  deleted: args?.deleted || false,
  from: args?.from || createUserSub(),
  to: args?.to || createUserSub(),
  missed: args?.missed || false,
  reactions: args?.reactions || null,
  type,
});

export const createUserSub = (
  args?: Partial<{
    name: string;
    createdDate: Date;
    auth: AuthType;
    active: Date;
  }>
): UserSub => ({
  id: uniqueId(),
  username: faker.helpers.unique(faker.random.alphaNumeric, [5]),
  name: args?.name || faker.helpers.unique(faker.name.fullName),
  createdDate: args?.createdDate?.getTime().toString() || testTime,
  auth: args?.auth || AuthType.PASSWORD,
  active: args?.active?.getTime().toString() || null,
  __typename: "User",
});

export const createUserType = (
  args?: Parameters<typeof createUserSub>[0] &
    Partial<{
      gender: Gender;
      mutual: boolean;
      notification: boolean;
      notifications: UserType["notifications"];
      bio: string;
      token: string;
      sub: UserSub;
    }>
): UserType => ({
  ...(args?.sub ||
    createUserSub({
      name: args?.name,
      createdDate: args?.createdDate,
      auth: args?.auth,
      active: args?.active,
    })),
  gender: args?.gender || Gender.NEUTRAL,
  bio: args?.bio || null,
  mutual: args?.mutual || false,
  token: args?.token || null,
  email: faker.helpers.unique(faker.internet.email, []),
  notification: args?.notification || false,
  notifications: args?.notifications || [
    {
      type: "CONVERSATIONS",
      total: 0,
    },
  ],
});

export const createPost = (
  args?: Partial<{
    id: string;
    media: string;
    body: string;
    stats: PostType["stats"];
    createdBy: UserSub;
    parent: PostType["parent"];
    createdDate: Date;
  }>
): PostType => ({
  id: args?.id || uniqueId(),
  body: args?.body || faker.helpers.unique(faker.lorem.lines),
  media: args?.media || null,
  createdDate: args?.createdDate?.getTime().toString() || testTime,
  createdBy: args?.createdBy || createUserSub(),
  stats: args?.stats || {
    likes: 0,
    comments: 0,
    liked: 0,
    __typename: "Stats",
  },
  parent: args?.parent || null,
  __typename: "Post",
});

export const mockQueries = {
  getUser: (authInput: AuthInput, user: UserType) => ({
    request: {
      query: gqlQuery("getUser"),
      variables: {
        authInput,
      },
    },
    result: user
      ? {
          data: {
            getUser: user,
          },
        }
      : {
          errors: createError("getUser", "User not found."),
        },
  }),
  getFollowCount: (authInput: AuthInput, counts: Follow) => ({
    request: {
      query: gqlQuery("getFollowCount"),
      variables: {
        authInput,
      },
    },
    result: {
      data: {
        getFollowCount: counts,
      },
    },
  }),
  getFollowStatus: (authInput: AuthInput, counts: Follow) => ({
    request: {
      query: gqlQuery("getFollowStatus"),
      variables: {
        authInput,
      },
    },
    result: {
      data: {
        getFollowStatus: counts,
      },
    },
  }),
  getUserPosts: (authInput: AuthInput, total: number, pages: number) =>
    generatePosts(total, pages, {
      authInput,
      key: "getUserPosts",
      liked: true,
    }),
  getUserComments: (authInput: AuthInput, total: number, pages: number) => {
    // 👇 parent post for comments
    const parent = createPost({
      stats: {
        comments: total * pages,
        liked: 1,
        likes: 10,
      },
    });
    return generatePosts(total, pages, {
      authInput,
      key: "getUserComments",
      liked: true,
      parent,
    });
  },
  getUserMedias: (authInput: AuthInput, total: number, pages: number) =>
    generatePosts(total, pages, {
      authInput,
      key: "getUserMedias",
      liked: true,
      media: true,
    }),
  getUserLikes: (authInput: AuthInput, total: number, pages: number) =>
    generatePosts(total, pages, {
      authInput,
      key: "getUserLikes",
      liked: true,
    }),
  getFollowing: (
    authInput: AuthInput,
    total: number,
    pages: number,
    mutual?: boolean
  ) =>
    generateUsers(total, pages, "getFollowing", {
      authInput,
      mutual,
    }),
  getFollowers: (
    authInput: AuthInput,
    total: number,
    pages: number,
    mutual?: boolean
  ) =>
    generateUsers(total, pages, "getFollowers", {
      authInput,
      mutual,
    }),
};

export const mockMutations = {
  createPost: (createPost?: PostType, error?: string) => ({
    request: {
      query: gqlMutations["createPost"],
      variables: {
        postInput: {
          id: createPost?.id === uploadId ? uploadId : undefined,
          body: createPost?.body,
        },
      },
    },
    result: createPost?.body
      ? {
          data: {
            createPost,
          },
        }
      : {
          errors: createError("createPost", error),
        },
  }),
  login: (input: AuthCredentials, error?: string) => ({
    request: {
      query: gqlMutations["login"],
      variables: {
        usernameOrEmail: input.usernameOrEmail,
        password: input.password,
      },
    },
    result:
      input!.password!.length >= 6
        ? {
            data: {
              login: createUserSub(),
            },
          }
        : {
            errors: createError("login", error),
          },
  }),
  register: (input: AuthCredentials, error?: string) => ({
    request: {
      query: gqlMutations["register"],
      variables: {
        userInput: input,
      },
    },
    result:
      input!.username!.indexOf("@") < 0
        ? {
            data: {
              register: createUserSub(),
            },
          }
        : {
            errors: createError("register", error),
          },
  }),
  followUser: (authInput: AuthInput) => ({
    request: {
      query: gqlMutations["followUser"],
      variables: {
        authInput,
      },
    },
    result: {
      data: {
        followUser: true,
      },
    },
  }),
  unFollowUser: (authInput: AuthInput) => ({
    request: {
      query: gqlMutations["unFollowUser"],
      variables: {
        authInput,
      },
    },
    result: {
      data: {
        unFollowUser: true,
      },
    },
  }),
  updateBio: (bio: string, error?: string) => ({
    request: {
      query: gqlMutations["updateBio"],
      variables: {
        bio,
      },
    },
    result:
      bio !== "__error__"
        ? {
            data: {
              updateBio: true,
            },
          }
        : {
            errors: createError("updateBio", error, {
              code: "UNAUTHENTICATED",
            }),
          },
  }),
  toggleNotification: (toggle: boolean) => ({
    request: {
      query: gqlMutations["toggleNotification"],
      variables: {
        toggle,
      },
    },
    result: {
      data: {
        toggleNotification: !toggle,
      },
    },
  }),
  logout: () => ({
    request: {
      query: gqlMutations["logout"],
      variables: {},
    },
    result: {
      data: {
        logout: true,
      },
    },
  }),
  addReactionMessage: (
    id: string,
    reaction: ReactionKeys,
    user: Partial<UserSub>
  ) => ({
    request: {
      query: gqlMutations["addReactionMessage"],
      variables: {
        id,
        reaction,
      },
    },
    result: {
      data: {
        addReactionMessage: {
          id: uniqueId(),
          user,
          createdDate: testTime,
          message: { id },
          reaction,
        } as ReactionType,
      },
    },
  }),
  removeReactionMessage: (id: string) => ({
    request: {
      query: gqlMutations["removeReactionMessage"],
      variables: {
        id,
      },
    },
    result: {
      data: {
        removeReactionMessage: true,
      },
    },
  }),
  deleteMessage: (id: string) => ({
    request: {
      query: gqlMutations["deleteMessage"],
      variables: {
        id,
      },
    },
    result: {
      data: {
        deleteMessage: createMessage("NEW_MESSAGE", {
          id,
        }),
      },
    },
  }),
  sendMessage: (
    messageInput: MessageInput,
    media?: string,
    error?: string
  ) => ({
    request: {
      query: gqlMutations["sendMessage"],
      variables: {
        messageInput,
      },
    },
    result:
      messageInput.body !== "__error__"
        ? {
            data: {
              sendMessage: createMessage("NEW_MESSAGE", {
                id: messageInput.id,
                body: messageInput.body,
                to: { id: messageInput.to },
                media,
              }),
            },
          }
        : {
            errors: createError("sendMessage", error, {
              code: "UNAUTHENTICATED",
              id: messageInput.id,
            }),
          },
  }),

  likePost: (id: string) => ({
    request: {
      query: gqlMutations["likePost"],
      variables: {
        id,
      },
    },
    result: {
      data: {
        likePost: true,
      },
    },
  }),

  unLikePost: (id: string) => ({
    request: {
      query: gqlMutations["unLikePost"],
      variables: {
        id,
      },
    },
    result: {
      data: {
        unLikePost: true,
      },
    },
  }),
};

export const mockSubscriptions = {
  notification: (notification: NotificationType) => ({
    request: {
      query: gqlSubscriptions["notification"],
      variables: {},
    },
    result: {
      data: {
        notification,
      },
    },
  }),
  conversations: (conversations: ConversationsType) => ({
    request: {
      query: gqlSubscriptions["conversations"],
      variables: {},
    },
    result: {
      data: {
        conversations,
      },
    },
  }),
  message: (message: Partial<MessageType>) => ({
    request: {
      query: gqlSubscriptions["message"],
      variables: {},
    },
    result: {
      data: {
        message,
      },
    },
  }),
  reacted: (reacted: Partial<ReactedType>) => ({
    request: {
      query: gqlSubscriptions["reacted"],
      variables: {},
    },
    result: {
      data: {
        reacted,
      },
    },
  }),
};

export const mockUploadProgress = (config?: AxiosRequestConfig) => {
  // 👇 this mocks a request which is always at 50% progress
  if (config?.onUploadProgress) {
    const total = 1024;
    const progress = 0.5;
    config?.onUploadProgress({ loaded: total * progress, total });
  }
};

export const mockIntersectionObserver = () => {
  window.IntersectionObserver = jest.fn().mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
};

export const mockAvatarUrl = (user?: string, auth?: string) =>
  auth ? `avatar-${auth}/${user}` : `avatar-${user}`;

// 👇 Note: Object.defineProperty is more consistent than jest.spyOn when working with tests with react
export const mockObjectURL = () => {
  /*
    // 👇 mock object URL representing the specified File object or Blob object
    window.URL.createObjectURL = jest.fn().mockReturnValue(objectUrl);
    // 👇 mock releasing an existing object URL
    window.URL.revokeObjectURL = jest.fn();
  */

  // 👇 mock object URL representing the specified File object or Blob object
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: () => objectUrl,
  });
  // 👇 mock releasing an existing object URL
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: jest.fn(),
  });
};

export const mockMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (): Partial<MediaQueryList> => ({
      matches: true,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      media: "",
    }),
  });
};

export const createTransitionendEvent = () => {
  const transitionendEvent = new Event("transitionend");
  Object.assign(transitionendEvent, {
    propertyName: "opacity",
  });
  return transitionendEvent;
};

const generateLastPage = (
  query: DocumentNode,
  key: GqlQueries,
  total: number,
  pages: number,
  variables?: KeyValue<string | number | AuthInput>
) => {
  // 👇 fetching gets last empty query twice due to loading state change
  const lastPage = Array.from({ length: 2 }).map(() => ({
    request: {
      query,
      variables: {
        offset: total * pages,
        ...variables,
      },
    },
    result: {
      data: {
        [key]: [],
      },
    },
  }));

  return lastPage;
};

export const generatePost = (
  stats: PostType["stats"],
  args?: Partial<{
    parent: PostType["parent"];
  }>
) => {
  const key = "getPost";
  const query = gqlQuery(key);
  const post = createPost({
    parent: args?.parent,
    stats,
  });

  return {
    post,
    response: {
      request: {
        query,
        variables: {
          id: post.id,
        },
      },
      result: {
        data: {
          [key]: post,
        },
      },
    },
  };
};

export const generatePosts = (
  total = 10,
  pages = 1,
  args?: Partial<{
    liked: boolean;
    parent: PostType["parent"];
    media: boolean;
    authInput: AuthInput;
    key: Extract<
      GqlQueries,
      | "getFollowers"
      | "getFollowing"
      | "getPosts"
      | "getUserComments"
      | "getUserLikes"
      | "getUserMedias"
      | "getUserPosts"
    >;
  }>
) => {
  const key = args?.key || "getPosts";
  const query = gqlQuery(key);

  const authInput = args?.authInput;
  const loadPages = Array.from({ length: pages }).map((_, index) => {
    const posts: PostType[] = [];
    for (let i = 0; i < total; i++) {
      posts.push(
        createPost({
          createdDate: testDate,
          media:
            args?.media || Math.random() > 0.5 ? "video/webm" : "image/png",
          parent: args?.parent,
          stats: {
            likes: randomNumber(),
            comments: randomNumber(),
            liked: !args?.liked || Math.random() > 0.5 ? 0 : 1,
          },
        })
      );
    }
    const variables: KeyValue<string | number | AuthInput> = {
      offset: total * index,
    };
    if (authInput) {
      variables.authInput = authInput;
    }
    if (!variables.authInput && args?.parent?.id) {
      variables.id = args.parent.id;
    }

    return {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          [key]: posts,
        },
      },
    };
  });

  return [
    ...loadPages,
    ...generateLastPage(query, key, total, pages, authInput && { authInput }),
  ];
};

export const generateUsers = (
  total = 10,
  pages = 1,
  key: Extract<GqlQueries, "getFollowers" | "getFollowing">,
  args?: Partial<{
    authInput: AuthInput;
    mutual: boolean;
  }>
) => {
  const query = gqlQuery(key);
  const authInput = args?.authInput;

  const loadPages = Array.from({ length: pages }).map((_, index) => {
    const users: UserType[] = [];
    for (let i = 0; i < total; i++) {
      users.push(
        createUserType({
          createdDate: testDate,
          mutual: args?.mutual,
        })
      );
    }
    const variables: KeyValue<string | number | AuthInput> = {
      offset: total * index,
    };
    if (authInput) {
      variables.authInput = authInput;
    }

    return {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          [key]: users,
        },
      },
    };
  });

  return [
    ...loadPages,
    ...generateLastPage(query, key, total, pages, authInput && { authInput }),
  ];
};

export const generateMessages = (
  total = 10,
  pages = 1,
  id: string,
  args?: Partial<{
    from: UserSub;
    to: UserSub;
    media: string;
    missed: boolean;
    deleted: boolean;
    reaction: boolean;
    error: string;
  }>
) => {
  const key = "getMessages";
  const query = gqlQuery(key);

  if (args?.error) {
    return [
      {
        request: {
          query,
          variables: {
            id,
            offset: 0,
          },
        },
        result: {
          errors: createError(key, args.error, {
            code: "UNAUTHENTICATED",
          }),
        },
      },
    ];
  }

  const loadPages = Array.from({ length: pages }).map((_, index) => {
    const messages: MessageType[] = [];
    for (let i = 0; i < total; i++) {
      const message = createMessage("NEW_MESSAGE", {
        from: args?.from,
        to: args?.to,
        deleted: args?.deleted,
        media: args?.media,
        missed: args?.missed,
        createdDate: testDate,
      });
      if (args?.reaction) {
        message.reactions = [];
        const reaction = {
          createdDate: testTime,
          message,
        };
        message.reactions.push({
          ...reaction,
          id: uniqueId(),
          reaction: "like",
          user: message.from,
        });
        message.reactions.push({
          ...reaction,
          id: uniqueId(),
          reaction: "love",
          user: message.to,
        });
      }

      messages.push(message);
    }
    const variables: KeyValue<string | number> = {
      id,
      offset: total * index,
    };

    return {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          [key]: messages,
        },
      },
    };
  });

  return [...loadPages, ...generateLastPage(query, key, total, pages, { id })];
};

export const generateConversations = (
  total = 10,
  pages = 1,
  args?: Partial<{
    from: UserSub;
    to: UserSub;
    seen: boolean;
    media: string;
    missed: boolean;
    deleted: boolean;
    error: string;
  }>
) => {
  const key = "getConversations";
  const query = gqlQuery(key);

  if (args?.error) {
    return [
      {
        request: {
          query,
          variables: {
            offset: 0,
          },
        },
        result: {
          errors: createError(key, args.error, {
            code: "UNAUTHENTICATED",
          }),
        },
      },
    ];
  }

  const loadPages = Array.from({ length: pages }).map((_, index) => {
    const conversations: ConversationType[] = [];
    for (let i = 0; i < total; i++) {
      const { id, from, to, body, deleted, media, missed, createdDate } =
        createMessage("NEW_MESSAGE", {
          from: args?.from,
          to: args?.to,
          deleted: args?.deleted,
          media: args?.media,
          missed: args?.missed,
          createdDate: testDate,
        });
      conversations.push({
        id: uniqueId(),
        from,
        to,
        seen: args?.seen || false,
        message: {
          id,
          body,
          deleted,
          media,
          missed,
          createdDate,
        },
      });
    }
    const variables: KeyValue<string | number> = {
      offset: total * index,
    };

    return {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          [key]: conversations,
        },
      },
    };
  });

  return [...loadPages, ...generateLastPage(query, key, total, pages)];
};

export const generateFindUsers = (handle: string, total = 5) => {
  const key = "findUser";
  const query = gqlQuery(key);
  const users: UserSub[] = [];
  for (let i = 0; i < total; i++) {
    users.push(createUserSub());
  }

  const response = {
    request: {
      query,
      variables: {
        handle,
      },
    },
    result: {
      data: {
        [key]: users,
      },
    },
  };

  return {
    users,
    response,
  };
};

export const generateNotifications = (
  total = 10,
  pages = 1,
  args?: Partial<{
    type: NotificationType["type"];
    identifier: string;
    error: string;
  }>
) => {
  const key = "getNotifications";
  const query = gqlQuery(key);

  if (args?.error) {
    return [
      {
        request: {
          query,
          variables: {
            offset: 0,
          },
        },
        result: {
          errors: createError(key, args.error, {
            code: "UNAUTHENTICATED",
          }),
        },
      },
    ];
  }

  const loadPages = Array.from({ length: pages }).map((_, index) => {
    const notifications: NotificationType[] = [];
    for (let i = 0; i < total; i++) {
      notifications.push(createNotification(args?.type!, args?.identifier!));
    }
    const variables: KeyValue<string | number> = {
      offset: total * index,
    };

    return {
      request: {
        query,
        variables,
      },
      result: {
        data: {
          [key]: notifications,
        },
      },
    };
  });

  return [...loadPages, ...generateLastPage(query, key, total, pages)];
};
