// 👇 React
import { useState, useEffect, useRef, useCallback } from "react";
// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, Row, Media, ToolTip } from "../styles/Containers";
// 👇 Components
import Reactions from "./Reactions";
import { Spinner } from "./Loader";
import MediaType from "./MediaType";
// 👇 Icons
import { ThreeDotsVerticalIcon, EmojiSmileIcon, Trash3Icon } from "./Icons";
// 👇 Custom hooks
import { USE_MUTATION } from "../hooks/useApollo";
import { useReference } from "../hooks/useReference";
// 👇 Context
import { useStore } from "../providers/context";
// 👇 Constants, Helpers & Types
import { MessageType, ReactionKeys } from "../utils/types";
import { reactions as reactionsConstant } from "../utils/constants";
import {
  formatTime,
  mediaUrl,
  testObserver,
  updateProperty,
} from "../utils/helpers";

const Container = styled.div<{ sender?: boolean }>`
  background: ${({ theme }) => theme.color.transparentLight};
  padding: 0.5em;
  border-radius: 1em;
  max-width: 70%;

  ${({ sender }) =>
    sender
      ? css`
          border-bottom-right-radius: 0;
        `
      : css`
          border-bottom-left-radius: 0;
        `}
`;

const DeletedMessage = styled(Text)<{ sender?: boolean }>`
  background: ${({ theme }) => theme.color.transparentLight};
  padding: 0.5em;
  border-radius: 1em;
  margin: 0.5em 0;
  max-width: 70%;
  font-style: italic;
  opacity: ${({ theme }) => theme.opacity.dim};
  ${({ sender }) =>
    sender
      ? css`
          border-bottom-right-radius: 0;
          margin-left: auto;
        `
      : css`
          border-bottom-left-radius: 0;
          margin-right: auto;
        `}
`;

const MessageOption = styled(Flex)<{ origin?: string }>`
  --value: 0;
  transform: scaleX(var(--value));
  opacity: var(--value);
  transform-origin: ${({ origin }) => origin};
  transition: all 0.25s;
  overflow: hidden;
`;

const VideoDate = styled(Text)`
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-position: under;
`;

const Message = ({
  message: { id, body, from, reactions, createdDate, deleted, media, missed },
  mediaLoaded, // after media loads callback
}: {
  message: MessageType;
  mediaLoaded?: () => void;
}) => {
  const theme = useTheme();
  const { user } = useStore();
  const container = useRef<HTMLDivElement | null>(null);
  const messageOptions = useRef<HTMLDivElement | null>(null);
  const variables = useReference({
    showReaction: false,
    origin: "left",
  });
  const [showMessageOption, setShowMessageOption] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<ReactionKeys | -1>(
    // 👇 get reaction matching the authenticated user
    reactions?.find((reaction) => reaction.user.id === user?.id)?.reaction || -1
  );

  const sender = from.id === user?.id;

  const setFalse = () => setShowMessageOption(false);

  // 👇 message option toggles
  const toggleMessageOption = useCallback(
    (position?: string) => {
      if (showMessageOption) {
        const options = messageOptions.current;
        if (!options) {
          return;
        }

        options.removeEventListener("transitionend", setFalse);
        options.addEventListener("transitionend", setFalse);
        updateProperty(options, {
          "--value": "0",
        });
      } else {
        variables.value.showReaction = false;
        variables.value.origin = position!;
        setShowMessageOption(true);
      }
    },
    [showMessageOption]
  );

  const DELETE_MESSAGE = USE_MUTATION<MessageType>("deleteMessage");

  // 👇 manage message scroll based on message option or reaction selection showing
  useEffect(() => {
    const options = messageOptions.current;
    const msg = container.current;
    if (!msg) {
      return;
    }
    if (options && showMessageOption) {
      updateProperty(options, {
        "--value": "1",
      });

      msg.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        // inline: "start",
      });
    }
    if (variables.value.showReaction) {
      msg.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        // inline: "start",
      });
      variables.value.showReaction = false;
    }
  }, [showMessageOption]);

  return (
    <Flex
      ref={container}
      position="static"
      direction="column"
      margin="0.5em 0"
      padding="0 0.5em"
      data-id={id}
      data-date={createdDate}
      data-testid={`message-container-${id}`}
    >
      {deleted ? (
        <DeletedMessage sender={sender}>
          ⊘ This message was deleted.
        </DeletedMessage>
      ) : missed ? (
        <Flex
          data-testid={`message-missed-${id}`}
          align="center"
          justify="center"
        >
          <Text bold color="rgb(255 0 0)" padding="0 0.25em" font="x-large">
            ✆
          </Text>
          <VideoDate dim>{`Missed video call at ${formatTime(
            createdDate
          )}`}</VideoDate>
        </Flex>
      ) : (
        <>
          {media && (
            <Media sender={sender} width="70%">
              <MediaType
                src={mediaUrl("message", id, media)}
                mimeType={media}
                afterLoad={mediaLoaded}
              />
            </Media>
          )}

          {variables.value.showReaction && (
            <Reactions
              messageId={id}
              initial={selectedReaction}
              onSelect={(reaction) => {
                variables.value.showReaction = false;
                setSelectedReaction(reaction);
              }}
            />
          )}

          <Flex
            data-testid={`message-body-${id}`}
            align="flex-start"
            direction={sender ? "row-reverse" : undefined}
            margin="0.5em 0" // reference for scrolling
          >
            <Container sender={sender}>
              <Text padding="0.5em 0">{body}</Text>
              <Flex
                justify={sender ? "flex-end" : undefined}
                margin={theme.spacing.top("0.5em")}
              >
                {createdDate === "LOADING" ? (
                  <Spinner />
                ) : (
                  <Text data-testid={`message-date-${id}`} dim font="x-small">
                    {createdDate === "ERROR"
                      ? "🚫 Message not sent"
                      : DELETE_MESSAGE.error
                      ? "🚫 Could not delete message"
                      : formatTime(createdDate)}
                  </Text>
                )}
              </Flex>
            </Container>

            {createdDate !== "LOADING" &&
              createdDate !== "ERROR" &&
              (DELETE_MESSAGE.loading ? (
                <Spinner />
              ) : (
                <ToolTip
                  data-testid={`message-options-${id}`}
                  hover={false}
                  padding="1em 0"
                  tip="More"
                  tipPosition={
                    showMessageOption ? "top" : sender ? "left" : "right"
                  }
                  onClick={() => toggleMessageOption(sender ? "right" : "left")}
                >
                  <ThreeDotsVerticalIcon />
                </ToolTip>
              ))}

            {showMessageOption && (
              <MessageOption
                data-testid={`message-options-selections-${id}`}
                ref={messageOptions}
                border={true}
                background="blurMax"
                width="unset"
                direction="column"
                margin="0.5em 0"
                origin={variables.value.origin}
              >
                <Row
                  data-testid={`message-options-react-${id}`}
                  hover
                  padding="0.5em"
                  align="center"
                  onClick={() => {
                    variables.value.showReaction = true;
                    toggleMessageOption();
                  }}
                >
                  <EmojiSmileIcon />
                  <Text padding={theme.spacing.left("0.5em")} hide>
                    React
                  </Text>
                </Row>
                {sender && (
                  <Row
                    data-testid={`message-options-delete-${id}`}
                    hover
                    padding="0.5em"
                    align="center"
                    onClick={() => {
                      testObserver("DELETE_MESSAGE");
                      // 👇 delete the message
                      DELETE_MESSAGE.mutate({
                        variables: {
                          id: id,
                        },
                      });
                      toggleMessageOption();
                    }}
                  >
                    <Trash3Icon />
                    <Text padding={theme.spacing.left("0.5em")} hide>
                      Delete
                    </Text>
                  </Row>
                )}
              </MessageOption>
            )}
          </Flex>

          {!!reactions?.length && (
            <Flex
              data-testid={`message-reaction-${id}`}
              top="-0.25em"
              {...(sender && {
                right: "0",
                direction: "row-reverse",
              })}
              width="unset"
              align="center"
            >
              <Flex width="unset">
                {reactions.reduce<JSX.Element[]>(
                  (output, { reaction, id }, index, array) => {
                    // 👇 update reaction count if same as other user else add the reaction
                    const duplicate =
                      index > 0 &&
                      array[index].reaction === array[index - 1].reaction;
                    if (!duplicate) {
                      output.push(
                        <Flex key={id} width="unset">
                          {reactionsConstant[reaction]}
                        </Flex>
                      );
                    }
                    return output;
                  },
                  []
                )}
              </Flex>
              <ToolTip
                tip={reactions
                  .map(
                    ({ reaction, user: { username, id } }) =>
                      // 👇 format reaction count display
                      `${reactionsConstant[reaction]} \\00a0 : \\00a0 ${
                        user?.id === id ? "You" : "@" + username
                      } \\A`
                  )
                  .join("")}
                tipPosition={sender ? "left" : "right"}
                ignoreMobile
                margin="0 0.5em"
              >
                <Text dim font="smaller">
                  {reactions.length}
                </Text>
              </ToolTip>
            </Flex>
          )}
        </>
      )}
    </Flex>
  );
};
export default Message;
