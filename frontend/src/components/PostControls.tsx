// 👇 React
import { useState, useLayoutEffect } from "react";
// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 Images
import heartAnim from "../images/animation/animHeart-transparent.gif";
// 👇 Icons
import { HeartIcon, CommentIcon, ShareIcon, HeartFillIcon } from "./Icons";
// 👇 Styles
import Image from "../styles/Image";
import { Text, Error } from "../styles/Text";
import { Flex, ToolTip } from "../styles/Containers";
// 👇 Context
import { useStore } from "../providers/context";
// 👇 Components
import { Spinner } from "./Loader";
import Attachment from "./Attachment";
// 👇 Custom hooks
import { useReference } from "../hooks/useReference";
import { USE_MUTATION } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { formatStats, secsToMs, testObserver } from "../utils/helpers";
import { BuildPost, InputType, PostType } from "../utils/types";

// 👇 like post or reply animation
const HeartAnimation = styled(Image)`
  position: absolute;
  left: 0;
  transform: translate(-35%, 1%);
`;

const HeartBorder = styled.span`
  transform: scale(0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.05s;
  ${({ theme }) => css`
    width: ${theme.sizing.icon};
    height: ${theme.sizing.icon};
  `}
  position: absolute;
  left: 0;
  top: 0;
  box-shadow: 0px 0px 1em 0.25em red;
  border-radius: 50%;
  background: red;
`;

const PostControls = ({
  build: {
    post: { id, stats, parent },
    depth,
  },
  dummyPost, // is it dummy post
  profile, // profile image
  createPost, // creating post status
  sendClick, // after post send is clicked
  updateThreads,
  commentClick,
  postLoading,
}: {
  build: BuildPost;
  dummyPost: boolean;
  profile: string;
  createPost: {
    loading: boolean;
    error?: string;
  };
  sendClick: (input: InputType, stats: PostType["stats"], id?: string) => void;
  updateThreads: () => void;
  commentClick: () => void;
  postLoading: boolean;
}) => {
  const theme = useTheme();
  const { reply, user } = useStore();
  const [postStats, setPostStats] = useState(stats);
  const [showAnim, setShowAnim] = useState(false);
  const postVariables = useReference({
    variables: {
      id: "",
    },
  });

  const LIKE_POST = USE_MUTATION<boolean>("likePost");
  const UNLIKE_POST = USE_MUTATION<boolean>("unLikePost");
  const ERROR = LIKE_POST.error || UNLIKE_POST.error;

  useLayoutEffect(() => updateThreads(), [ERROR, createPost.error]);

  return (
    <>
      <Flex
        justify="space-between"
        padding={theme.spacing.bottom(ERROR || reply === id ? "0.5em" : "2em")}
      >
        <Flex align="center">
          {(LIKE_POST.loading || UNLIKE_POST.loading) &&
          postVariables.value.variables.id === id ? (
            <Spinner />
          ) : (
            <ToolTip
              data-testid={`likeIcon-${id}`}
              hover={false}
              tip={postStats.liked ? "unlike" : "like"}
              tipPosition="top"
              // 👇 like or nuLike post or reply clicked
              onClick={async () => {
                if (dummyPost) {
                  return;
                }

                postVariables.value.variables.id = id;

                if (postStats.liked) {
                  testObserver("UNLIKE_POST");
                  const { data } = await UNLIKE_POST.mutate(
                    postVariables.value
                  );

                  if (data?.[UNLIKE_POST.query]) {
                    setPostStats((prev) => ({
                      ...prev,
                      liked: 0,
                      likes: prev.likes - 1,
                    }));
                  }
                } else {
                  testObserver("LIKE_POST");
                  const { data } = await LIKE_POST.mutate(postVariables.value);

                  if (data?.[LIKE_POST.query]) {
                    setShowAnim(true);
                  }
                }
              }}
            >
              {showAnim && (
                // 👇 show like animation for 2secs
                <HeartAnimation
                  data-testid={`likeAnimation-${id}`}
                  blur={false}
                  src={heartAnim}
                  size="53px"
                  ratio="width"
                  onLoad={() => {
                    setTimeout(() => {
                      setPostStats((prev) => ({
                        ...prev,
                        liked: 1,
                        likes: prev.likes + 1,
                      }));
                      setShowAnim(false);
                    }, secsToMs(2));
                  }}
                />
              )}

              {postStats.liked ? (
                <>
                  <HeartFillIcon
                    data-testid={`likeIcon-${id}-liked`}
                    margin={theme.spacing.right("0.5em")}
                  />
                  <HeartBorder className="hover-opacity" />
                </>
              ) : (
                <HeartIcon margin={theme.spacing.right("0.5em")} />
              )}

              <Text dim transform="uppercase">
                {formatStats(postStats.likes)}
              </Text>
            </ToolTip>
          )}
        </Flex>
        <Flex align="center">
          {postLoading ? (
            <Spinner />
          ) : (
            <ToolTip
              data-testid={`commentIcon-${id}`}
              hover={false}
              onClick={() => {
                if (dummyPost) {
                  return;
                }

                // 👇 reset including clearing errors
                LIKE_POST.reset();
                UNLIKE_POST.reset();

                // 👇 open replies in current or new tab window
                depth > 1
                  ? window.open(`/${parent ? "reply" : "post"}/${id}`, "_blank")
                  : commentClick();
              }}
            >
              <CommentIcon margin={theme.spacing.right("0.5em")} />
              <Text dim>{formatStats(postStats.comments)}</Text>
            </ToolTip>
          )}
        </Flex>
        <ToolTip data-testid={`shareIcon-${id}`} hover={false}>
          <ShareIcon />
        </ToolTip>
      </Flex>
      {ERROR && (
        <Error padding={reply === id ? "0" : theme.spacing.bottom("1.5em")}>
          {ERROR}
        </Error>
      )}
      {reply === id && user && (
        <Attachment
          wsKey={id}
          category="REPLY"
          sendTip="Reply"
          onUpdate={() => updateThreads()}
          sendClick={(input, id) => sendClick(input, postStats, id)}
          inputProps={{
            placeholder: "Write a reply...",
            heightChange: () => updateThreads(),
            profile,
            emojiProp: {
              iconInsideInput: true,
              position: "bottom",
            },
            loading: createPost.loading,
            error: createPost.error,
            handle: true,
          }}
        />
      )}
    </>
  );
};

export default PostControls;
