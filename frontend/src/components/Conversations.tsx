// 👇 React
import { useCallback, useLayoutEffect, useState } from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Intersection Observer
import { useInView } from "react-intersection-observer";
// 👇 Apollo & Graphql
import { gql } from "@apollo/client";
// 👇 Styles
import { Flex, List, ToolTip } from "../styles/Containers";
import { Text } from "../styles/Text";
// 👇 Custom hooks
import { usePagination } from "../hooks/usePagination";
import { USE_SUBSCRIPTION, USE_QUERY } from "../hooks/useApollo";
import { useWsMessage } from "../hooks/useWsMessage";
import { useReference } from "../hooks/useReference";
import { useSearch } from "../hooks/useSearch";
// 👇 Context
import { useDispatch, useStore } from "../providers/context";
import { useWs } from "../providers/ws";
// 👇 Services
import dayjs from "../services/dayjs";
// 👇 Components
import { CameraVideoIcon, ChatIcon } from "./Icons";
import Notify from "./Notify";
import Chat from "./Chat";
import VideoCall from "./VideoCall";
import SearchInput from "./SearchInput";
// 👇 Constants, Helpers & Types
import { ConversationType, KeyValue, MessageType } from "../utils/types";
import {
  avatarUrl,
  constructMessage,
  formatTime,
  isMimeType,
  secsToMs,
  testObserver,
} from "../utils/helpers";
import { gqlConversation } from "../utils/constants";
import { ActionType } from "../utils/types/enum";
import { faker } from "@faker-js/faker";

const CameraVideoIconEdit = styled(CameraVideoIcon)`
  --dimension: 1.25em;
  margin-right: 0.5em;
`;
const ChatIconEdit = styled(ChatIcon)`
  --dimension: 1em;
  margin-right: 0.5em;
`;

const Back = styled(Text)`
  transform: scale(1.5, 1);
  transform-origin: right;
  /* padding-left: 0.5em; */
`;

const Container = styled(Flex)`
  position: absolute;
  right: 0.5em;
  top: 100%;
  width: 70%;
  height: 80vh;
  /* mobile */
  @media (max-width: 575px) {
    width: 90%;
  }
`;

const Conversations = ({ onClose }: { onClose?: () => void }) => {
  const theme = useTheme();
  const { user, chat, answer } = useStore();
  const dispatch = useDispatch();
  const { ref, inView } = useInView({
    initialInView: true,
  });
  const { paginate, finished, reset, Progress } = usePagination(ref, inView);
  const ws = useWs();
  const [status, setStatus] = useState("LOADING");
  const [showVideo, setShowVideo] = useState(Boolean(answer));
  const reload = useReference(true);
  const onlineTimeOut = useReference(0);

  const GET_CONVERSATIONS = USE_QUERY<ConversationType[]>(
    true,
    "getConversations"
  );

  USE_SUBSCRIPTION<MessageType>("message", (data) => {
    // 👇 No need to update conversation if chatting
    if (chat) {
      return;
    }

    GET_CONVERSATIONS.cache.modify({
      fields: {
        [GET_CONVERSATIONS.query](
          conversations: ConversationType[] | null,
          { readField }
        ) {
          if (!conversations) {
            return conversations;
          }

          const { id, body, createdDate, missed, deleted, media, from, to } =
            data;

          const conversation: ConversationType = {
            // 👇 simple unique id generate
            id: faker.helpers.unique(faker.datatype.uuid), //id + id,
            __typename: "Conversation",
            from,
            to,
            seen: false,
            message: {
              __typename: "Message",
              id,
              body,
              createdDate,
              missed,
              deleted,
              media,
            },
          };

          const newMessage = GET_CONVERSATIONS.cache.writeFragment({
            data: conversation,
            // 👇 used 'fragment Conversation' as fragment name must be unique
            fragment: gql`
                  fragment Conversation on Message {
                    ${gqlConversation}
                  }
                `,
          });

          // 👇 find conversation matching message
          const index = conversations.findIndex((ref) => {
            // const refFrom = readField("id", ref.from);
            // const reFto = readField("id", ref.to);
            const refFrom = readField("id", readField("from", ref));
            const reFto = readField("id", readField("to", ref));

            return (
              (refFrom === from.id && reFto === to.id) ||
              (refFrom === to.id && reFto === from.id)
            );
          });

          if (index >= 0) {
            testObserver("GET_CONVERSATIONS-CACHE_UPDATE");
            return conversations.map((item, idx) =>
              idx === index ? newMessage : item
            );
          }

          testObserver("GET_CONVERSATIONS-CACHE_ADD");

          // 👇 add new message to existing conversations in cache
          return [newMessage, ...conversations];
        },
      },
    });
  });

  // 👇 online user checker
  const checkOnline = useCallback(() => {
    onlineTimeOut.update(
      window.setInterval(() => {
        ws?.send(
          constructMessage({
            type: "ONLINE",
            to: chat?.id,
          })
        );
      }, secsToMs(1))
    );
  }, [ws, chat]);

  const stopOnlineCheck = () => window.clearInterval(onlineTimeOut.value);

  // 👇 online user status updater
  useWsMessage(
    ({ type, content }) => {
      if (type !== "ONLINE") {
        return;
      }
      const { id, online } = content as KeyValue;
      if (id !== chat?.id) {
        return;
      }
      switch (online) {
        case "NONE":
          setStatus("Last seen -");
          break;
        case "ONLINE":
          setStatus(online);
          break;
        case "TYPING":
          setStatus("Typing...");
          break;

        default:
          setStatus("Last seen " + dayjs(Number(online)).fromNow());
          break;
      }
    },
    [chat]
  );

  useLayoutEffect(() => {
    // 👇 resets pagination to force refetch
    if (reload.value) {
      reload.update(false);
      reset();
    } else if (finished || !inView) {
      return;
    }

    paginate(GET_CONVERSATIONS);
  }, [inView, GET_CONVERSATIONS.loading, chat]);

  useLayoutEffect(() => {
    setShowVideo(Boolean(answer));

    // 👇 stop online checking status
    stopOnlineCheck();

    if (chat) {
      // 👇 start online checking status if chatting
      if (ws?.readyState === ws?.OPEN) {
        checkOnline();
      }
    } else {
      setStatus("LOADING");
    }
    // 👇 top online checking status on  unmount
    return () => stopOnlineCheck();
  }, [chat, answer, ws]);

  const findUser = useSearch({
    // 👇 start chatting user from user found results
    onClick: (user) => dispatch(ActionType.CHAT, user),
  });

  return (
    <Container
      data-testid="tab-conversations"
      direction="column"
      padding="1em"
      background
      border
    >
      <Flex justify="space-between" padding="1em 0 0.5em 0.5em">
        <Text bold font="x-large">
          Chats
        </Text>

        {/* 
      <ToolTip
        align="center"
        tip="Create group"
        // margin="0"
        border
      >
          <PeopleIcon />
        </ToolTip> 
      */}

        <ToolTip
          data-testid="close-conversations"
          tip="Close"
          hover={false}
          tipPosition="top"
          // border
          onClick={() => onClose?.()}
        >
          <Text dim font="1.25em">
            ✕
          </Text>
        </ToolTip>
      </Flex>

      {/* Conversation */}
      <>
        {chat || showVideo ? (
          <>
            <Notify
              profile={{
                src: avatarUrl(chat?.id),
              }}
              row={{
                padding: "0",
                margin: theme.spacing.bottom("0.5em"),
              }}
              message={{
                text: chat?.name,
                subText: status,
                loading: status === "LOADING" && "subText",
              }}
              element={
                <Flex width="unset" align="center">
                  <ToolTip
                    data-testid={`start-${
                      showVideo ? "conversation" : "video-call"
                    }`}
                    hover={false}
                    tip={`Start a ${showVideo ? "conversation" : "video call"}`}
                    tipPosition="top"
                    onClick={() => {
                      setShowVideo(!showVideo);
                    }}
                  >
                    {showVideo ? <ChatIconEdit /> : <CameraVideoIconEdit />}
                  </ToolTip>
                  <ToolTip
                    data-testid="back-conversation"
                    hover={false}
                    overflow="hidden"
                    tip="Conversations"
                    margin={theme.spacing.left("0.5em")}
                    tipPosition="top"
                    onClick={() => {
                      reload.update(true);
                      dispatch(ActionType.CHAT, null);
                      setShowVideo(false);
                    }}
                  >
                    <Back dim>《</Back>
                  </ToolTip>
                </Flex>
              }
            />

            {showVideo ? <VideoCall calling={chat} /> : <Chat />}
          </>
        ) : (
          <>
            <SearchInput
              maxWidth="100%"
              margin="1em 0 0.5em"
              placeholder="Find User"
              valueChanged={(value) => findUser.search.update(value.trim())}
            />

            <List align="center" border>
              {findUser.search.value && findUser.component}

              {GET_CONVERSATIONS.data?.map(
                ({ id, from, to, message, seen }) => {
                  const highlight = to.id === user?.id && !seen;
                  const sender = from.id === user?.id;
                  const other = sender ? to : from;
                  const call = !sender && !message.deleted && message.missed;
                  const media = !message.deleted && Boolean(message.media);

                  // 👇 format message body
                  const body = message.deleted
                    ? sender
                      ? "⊘ You deleted this message."
                      : "⊘ This message was deleted."
                    : message.media
                    ? isMimeType("image", message.media)
                      ? "Image"
                      : isMimeType("video", message.media)
                      ? "Video"
                      : "Audio"
                    : message.missed
                    ? call
                      ? "Missed video call."
                      : "You called at " + formatTime(message.createdDate)
                    : message.body;

                  return (
                    <Notify
                      testId={`conversations-${id}`}
                      key={id}
                      profile={{
                        src: avatarUrl(other.id),
                      }}
                      row={{
                        hover: true,
                        highlight,
                        padding: "0.5em",
                        margin: theme.spacing.top("0.25em"),
                        click: () => {
                          dispatch(ActionType.CHAT, other);

                          // 👇 set conversation to seen when clicked
                          if (highlight) {
                            testObserver("SEEN_CONVERSATION");

                            ws?.send(
                              constructMessage({
                                type: "SEEN_CONVERSATION",
                                content: other?.id,
                              })
                            );
                          }
                        },
                      }}
                      message={{
                        text: other.name,
                        call,
                        media,
                        subText: body!,
                      }}
                      element={
                        <Flex
                          direction="column"
                          width="unset"
                          align="center"
                          justify="space-evenly"
                          margin={theme.spacing.left("0.5em")}
                        >
                          <Text
                            font="smaller"
                            dim={!highlight}
                            bold={highlight}
                            preserve
                          >
                            {dayjs(Number(message.createdDate)).fromNow()}
                          </Text>
                        </Flex>
                      }
                    />
                  );
                }
              )}
              <Progress placeholder={true} />
            </List>
          </>
        )}
      </>
    </Container>
  );
};

export default Conversations;
