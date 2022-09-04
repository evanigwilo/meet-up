// 👇 React
import React, {
  createRef,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  Fragment,
} from "react";
// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, Media, ToolTip } from "../styles/Containers";
import { Anchor } from "../styles/Anchor";
// 👇 Custom hooks
import { useResize } from "../hooks/useResize";
import { USE_MUTATION, USE_QUERY } from "../hooks/useApollo";
// 👇 Services
import dayjs from "../services/dayjs";
// 👇 Components
import { Spinner } from "./Loader";
import LoadingImage from "./LoadingImage";
import PostControls from "./PostControls";
import MediaType from "./MediaType";
// 👇 Context
import { useDispatch, useStore } from "../providers/context";
// 👇 Helpers & Types
import { KeyValue, PostType, BuildPost } from "../utils/types";
import {
  authPath,
  avatarUrl,
  mediaUrl,
  testObserver,
  updateProperty,
} from "../utils/helpers";
import { ActionType } from "../utils/types/enum";

const minHeight = "50px";

const Container = styled(Flex)<{ thread?: boolean }>`
  --placement: 0px;
  --height: 0px;
  /* height 10s, width 10s, bottom 10s; */
  min-height: ${minHeight};
  background-color: ${({ theme }) => theme.color.transparentLight};
  border-radius: 1.5em;
  ${({ thread }) =>
    thread &&
    css`
      &:before {
        content: "";
        position: absolute;
        left: calc(-25px - 3px * 2);
        width: calc(25px + 3px);
        border: ${({ theme }) => `3px solid ${theme.color.scrollTrack}`};
        border-right: none;
        border-top: none;
        border-bottom-left-radius: 1.5em;
        transition: opacity 0.25s;
        height: var(--height);
        bottom: var(--placement);
      }
    `};
`;

const CreatedDate = styled(Text)`
  &::first-letter {
    /* text-transform: uppercase; */
  }
`;

const Tab = styled(Text)`
  transform: scaleX(-1);
`;

// 👇 post replies builder with threads
const buildPost = (
  build: BuildPost[],
  posts: KeyValue<PostType[]>,
  start: string,
  parent?: PostType["parent"],
  width = "100%",
  depth = 0
) => {
  const w = `calc(${width} - 1em - ${minHeight})`;
  const d = depth + 1;
  let h = 1;
  let t = 1;
  posts[start]?.forEach((post, index) => {
    build.push({
      post: {
        ...post,
        ...(parent?.id === post.id && { stats: parent.stats }),
      },
      width: w,
      depth: d,
      height: t + index - 1,
    });
    t = buildPost(build, posts, post.id, parent, w, d);
    h += t;
  });
  return h;
};

// 👇 reply threads updater
const updateThreads = (
  build: BuildPost[],
  refs: Map<string, React.RefObject<HTMLDivElement>>
) => {
  build.forEach(({ height, post: { id } }, index) => {
    let totalHeight = 0;
    const element = refs.get(id)?.current;
    if (!element) {
      return;
    }
    for (let i = 0; i < height; i++) {
      const element = build[index - 1 - i].post;
      const height = refs.get(element.id)!.current!.clientHeight;
      totalHeight += height;
    }

    updateProperty(element, {
      "--placement": `calc(${element.clientHeight}px - 1em - 25px)`,
      "--height": `calc(${totalHeight - 3}px +  ${height}em + (25px + 2em))`,
    });
  });
};

const Post = ({ post, detail }: { post: PostType; detail?: string }) => {
  const theme = useTheme();
  const { reply, user } = useStore();
  const dispatch = useDispatch();
  const [posts, setPosts] = useState<KeyValue<PostType[]>>({});
  // 👇 last reply for post for viewing more replies
  const { current: viewMore } = useRef<
    KeyValue<{
      id: string;
      length: number;
    }>
  >({});
  // 👇 reference for each replies
  const { current: refs } = useRef<
    Map<string, React.RefObject<HTMLDivElement>>
  >(new Map());
  const [loading, setLoading] = useState<
    Partial<{
      post: string;
      reply: string;
    }>
  >({});
  // 👇 the post for which replies will be built upon
  const { current: parentPost } = useRef<BuildPost>({
    depth: 0,
    width: "100%",
    height: 0,
    post: {
      ...post,
      stats: {
        ...post.stats,
      },
    },
  });
  // 👇 built post with replies
  const { current: build } = useRef<BuildPost[]>([parentPost]);

  const GET_POSTS = USE_QUERY<PostType[]>(false, "getPosts");
  const CREATE_POST = USE_MUTATION<PostType>("createPost");

  // 👇 add reply to build and re-build post and replies
  const addReply = useCallback(
    (
      id: string,
      value: PostType[],
      add: boolean | "TOP" = false,
      update = -1
    ) =>
      setPosts((prev) => {
        const curr = { ...prev };
        if (add) {
          curr[id] = curr[id] || [];

          // 👇 add new reply to top or bottom of replies
          if (add === "TOP") {
            curr[id] = [...value, ...curr[id]];
          } else {
            curr[id] = [...curr[id], ...value];
          }
        } else {
          // 👇 update reply
          if (update >= 0) {
            curr[id][update] = value[0];
          } else {
            curr[id] = value;
          }
        }

        value.forEach(({ id }) => {
          curr[id] = [];
        });

        // 👇 parent of each replies are the same
        const { parent } = value[0];
        if (parent?.stats && parent?.id === parentPost.post.id) {
          parentPost.post.stats = parent.stats;
        }

        refs.clear();
        build.length = 0;
        build.push(parentPost);
        // 👇 re-build post with replies
        buildPost(build, curr, parentPost.post.id, parent);

        return curr;
      }),
    []
  );

  const fetchReplies = useCallback(
    async (id: string, option: keyof typeof loading) => {
      const variables = { id, offset: 0 };

      if (option === "post") {
        setLoading({
          post: id,
          reply: undefined,
        });
      } else {
        setLoading({
          post: undefined,
          reply: id,
        });

        variables.id = viewMore[id].id;
        variables.offset = viewMore[id].length;
      }

      testObserver("GET_POSTS");

      const { data } = await GET_POSTS.fetch({
        variables,
      });

      // 👇 delete last "view more comments"
      const postParent = posts[variables.id];
      if (postParent?.length) {
        const lastPost = postParent[postParent.length - 1];
        delete viewMore[lastPost.id];
      }

      setLoading({
        post: undefined,
        reply: undefined,
      });

      // 👇 only one reply at a time
      dispatch(ActionType.REPLYING, id);

      if (!data?.[GET_POSTS.query].length) {
        return;
      }

      const { length } = data[GET_POSTS.query];
      const lastPost = data[GET_POSTS.query][length - 1];

      // 👇 parent of each replies are the same
      const parentStats = lastPost.parent?.stats;

      if (
        parentStats &&
        parentStats.comments - (length + variables.offset) > 0
      ) {
        viewMore[lastPost.id] = {
          id: variables.id,
          length: variables.offset + length,
        };
      }

      // 👇 add replies to the corresponding post or reply
      addReply(variables.id, data[GET_POSTS.query], option === "reply");
    },
    [posts, loading]
  );
  // 👇 fetch replies if viewing post in detail
  useLayoutEffect(() => {
    if (detail) {
      fetchReplies(post.id, "post");
    }
  }, []);

  useLayoutEffect(() => updateThreads(build, refs), [posts, reply, loading]);

  useResize(() => updateThreads(build, refs));

  return (
    <>
      {build.map(
        (
          {
            post: { id, body, createdDate, media, createdBy, parent, stats },
            width,
          },
          index
        ) => {
          // 👇 dummy post from simulated show new post
          const dummyPost = id.endsWith(":POST");
          const profile = avatarUrl(createdBy.id);
          const ref = createRef<HTMLDivElement>();
          const category = parent ? "reply" : "post";
          refs.set(id, ref);

          return (
            <Fragment
              // 👇 key includes properties that will likely change
              key={
                id +
                stats.likes +
                stats.liked +
                stats.comments +
                parent?.stats?.likes +
                parent?.stats?.liked +
                parent?.stats?.comments
              }
            >
              <Flex
                data-testid={`${category}-${id}`}
                direction="row-reverse"
                index={reply === id ? 2 : 0}
              >
                <Container
                  ref={ref}
                  top="1em"
                  width={width}
                  thread={index > 0}
                  margin={theme.spacing.bottom("1em")}
                  padding={`1.5em 1.5em ${reply === id ? "1.5em" : "0"} 1.5em`}
                >
                  <LoadingImage size="4em" src={profile} />
                  <Flex
                    direction="column"
                    padding={theme.spacing.left("1em")}
                    width="calc(100% - 4em)"
                  >
                    <Flex
                      justify="space-between"
                      align="center"
                      padding={theme.spacing.bottom("0.25em")}
                    >
                      <Flex
                        align="center"
                        wrap="wrap"
                        max={{
                          width: "90%",
                        }}
                        padding={theme.spacing.bottom("0.25em")}
                      >
                        <Anchor to={authPath(createdBy)}>
                          <Text bold ellipsis={1}>
                            {createdBy.name}
                          </Text>
                        </Anchor>
                        <Text
                          dim
                          ellipsis={1}
                          padding={theme.spacing.left("0.25em")}
                        >
                          {"@" + createdBy.username}
                        </Text>
                      </Flex>
                      {/* 
                        <MoreIcon
                          margin={theme.spacing.right("0.5em")}
                        /> 
                        */}
                    </Flex>
                    <CreatedDate
                      data-testid={`createdDate-${id}`}
                      dim
                      paragraph
                      font="smaller"
                      padding={theme.spacing.bottom("1em")}
                    >
                      {/* {"Few minutes ago"} */}
                      {dayjs(Number(createdDate)).fromNow()}
                    </CreatedDate>
                    <Text paragraph padding={theme.spacing.bottom("1em")}>
                      {body}
                    </Text>
                    {media && (
                      <Media height="45em" margin={theme.spacing.bottom("1em")}>
                        <MediaType
                          src={mediaUrl(category, id, media)}
                          mimeType={media}
                          afterLoad={() => updateThreads(build, refs)}
                        />
                      </Media>
                    )}
                    <PostControls
                      build={build[index]}
                      dummyPost={dummyPost}
                      createPost={{
                        loading: CREATE_POST.loading,
                        error: CREATE_POST.error,
                      }}
                      profile={avatarUrl(user?.id)}
                      postLoading={loading?.post === id}
                      updateThreads={() => updateThreads(build, refs)}
                      commentClick={() => {
                        fetchReplies(id, "post");
                      }}
                      sendClick={async (input, stats, uniqueId) => {
                        const { data } = await CREATE_POST.mutate({
                          variables: {
                            postInput: {
                              id: uniqueId,
                              body: input.value,
                              parent: id,
                            },
                          },
                        });

                        if (!data?.createPost) {
                          return;
                        }

                        const { createPost } = data;

                        // 👇 update parent of this post or reply stats
                        if (createPost.parent) {
                          createPost.parent.stats = stats;
                          createPost.parent.stats.comments += 1;
                        }

                        // 👇 add the reply to the top to simulate new reply
                        addReply(id, [createPost], "TOP");

                        // 👇 increase query offset
                        const postParent = posts[id];
                        if (postParent?.length) {
                          const lastPost = postParent[postParent.length - 1];
                          if (viewMore[lastPost.id]) {
                            viewMore[lastPost.id].length += 1;
                          }
                        }
                        // 👇 clear input after send
                        input.setValue("");
                      }}
                    />
                  </Flex>
                  {detail !== id && !dummyPost && (
                    <ToolTip
                      data-testid={`newTab-${id}`}
                      tip="View thread"
                      tipPosition="top"
                      position="absolute"
                      right="1.5em"
                      top="1em"
                      hover={false}
                    >
                      <Anchor
                        to={`/${parent ? "reply" : "post"}/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Tab dim paragraph font="x-large">
                          ⇱
                        </Tab>
                      </Anchor>
                    </ToolTip>
                  )}
                </Container>
              </Flex>
              {viewMore[id] && (
                <Flex
                  margin={theme.spacing.left("auto")}
                  padding="0.5em"
                  width={width}
                >
                  {loading?.reply === id ? (
                    <Spinner />
                  ) : (
                    <Text dim hover onClick={() => fetchReplies(id, "reply")}>
                      View more comments
                    </Text>
                  )}
                </Flex>
              )}
            </Fragment>
          );
        }
      )}
    </>
  );
};

export default Post;
