// 👇 React
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 Apollo & Graphql
import { gql, useApolloClient } from "@apollo/client";
// 👇 Intersection Observer
import { useInView } from "react-intersection-observer";
// 👇 Styles
import Image from "../styles/Image";
import { Error, Text } from "../styles/Text";
import { Flex, List } from "../styles/Containers";
// 👇 Components
import Message from "./Message";
import { Spinner } from "./Loader";
import Attachment from "./Attachment";
// 👇 Context
import { useStore } from "../providers/context";
import { useWs } from "../providers/ws";
// 👇 Custom hooks
import { USE_SUBSCRIPTION, USE_QUERY, USE_MUTATION } from "../hooks/useApollo";
import { usePagination } from "../hooks/usePagination";
import { useReference } from "../hooks/useReference";
// 👇 Constants, Helpers & Types
import { gqlMessage, gqlReaction } from "../utils/constants";
import {
  Follow,
  MessageInput,
  MessageType,
  ReactedType,
  ReactionType,
} from "../utils/types";
import {
  avatarUrl,
  constructMessage,
  secsToMs,
  testObserver,
  updateStyle,
} from "../utils/helpers";
import { AuthType } from "../utils/types/enum";

const Container = styled(List)`
  opacity: ${({ theme }) => theme.opacity.dim};
  pointer-events: none;
`;
const Info = styled(Text)`
  padding: 0.25em;
`;

const MessageDate = styled(Text)<{ transition?: boolean }>`
  ${({ transition }) => {
    return transition
      ? css`
          transition: all 0.15s;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
          text-align: center;
          left: 50%;
          /* 👇 minus scrollbar width */
          transform: translateX(calc(-50% - 0.5em));
          margin-top: 0;
          background-color: ${({ theme }) => theme.color.transparentLight};
          backdrop-filter: ${({ theme }) => theme.blur.min};
          padding: 0.5em;
          border-radius: 8px;
        `
      : css`
          margin: 0.5em auto;
        `;
  }}
`;

const Chat = () => {
  const theme = useTheme();
  const client = useApolloClient();
  const ws = useWs();
  const { ref: inViewRef, inView } = useInView({
    initialInView: true,
  });
  const { answer, user, chat } = useStore();
  const { paginate, finished, error, reset } = usePagination(inViewRef, inView);
  const [loaded, setLoaded] = useState<"YES" | "NO" | "RESET">("NO");
  const [showVideo, setShowVideo] = useState(Boolean(answer));
  const container = useRef<HTMLDivElement | null>(null);
  const totalMessages = useReference(0);
  const lastMessage = useReference<string | undefined>(undefined);
  const { current: messageVariables } = useRef<
    Partial<{
      loader: HTMLDivElement;
      container: HTMLDivElement;
      cache: "UPDATE" | "SEND" | "NEW" | "DELETE";
    }> & {
      message: Partial<MessageInput>;
    } & {
      date: Partial<{
        element: HTMLSpanElement;
        text: string;
        styleTimeOut: number;
      }>;
    }
  >({
    message: {
      to: chat?.id,
    },
    date: {
      styleTimeOut: 0,
    },
  });

  const GET_MESSAGES = USE_QUERY<MessageType[]>(true, "getMessages", {
    id: chat?.id,
    // limit: 1,
  });

  const FOLLOW_COUNT = USE_QUERY<Follow>(false, "getFollowCount", {
    authInput: { auth: chat?.auth, username: chat?.username },
  });

  USE_SUBSCRIPTION<MessageType>("message", (data) => {
    const { id, from, type } = data;

    if (type === "DELETED_MESSAGE") {
      cacheUpdateMessage(id, "DELETE");
    } else if (
      // 👇 chatting the user
      from.id === messageVariables.message.to
    ) {
      // 👇 keep scroll for media after load
      messageVariables.message.id = data.id;
      cacheAddMessage(data, "NEW");
    }
  });

  USE_SUBSCRIPTION<ReactedType>("reacted", (data) => {
    const { deleted, message, reaction } = data;

    const read = {
      id: `Message:${message}`,
      fragment: gql`
        fragment reacted on Message {
          reactions {
            ${gqlReaction}
          }
        }
      `,
    };

    // 👇 read the message reactions
    const readReactions = client.cache.readFragment(read) as {
      reactions?: ReactionType[] | null;
    };

    let reactions: ReactionType[] | undefined = undefined;

    if (deleted) {
      testObserver("REACTIONS-CACHE_DELETE");
      // 👇 remove the reaction
      reactions = readReactions?.reactions?.filter(
        (reaction) => reaction.user.id !== data.user
      );
    } else {
      // 👇 add the reaction
      reactions = readReactions?.reactions ? [...readReactions.reactions] : [];

      const tempDate = Date.now().toString();

      const exist = reactions.findIndex(
        (reaction) => reaction.user.id === data.user
      );
      if (exist >= 0) {
        testObserver("REACTIONS-CACHE_UPDATE");
        // 👇 update reaction within the cache
        reactions[exist] = {
          ...reactions[exist],
          id: tempDate,
          reaction,
        };
      } else {
        testObserver("REACTIONS-CACHE_ADD");
        // 👇 create reaction within the cache
        reactions.push({
          id: tempDate,
          reaction,
          user: {
            id: data.user,
            // 👇 set the right username
            username: data.user === chat?.id ? chat.username : user?.username,
            name: tempDate,
            auth: AuthType.PASSWORD,
            active: tempDate,
            createdDate: tempDate,
            __typename: "User",
          },
          createdDate: tempDate,
          message: null,
          __typename: "Reaction",
        });
      }
    }

    testObserver("REACTIONS-CACHE_WRITE");
    // 👇 update message reaction in cache
    client.cache.writeFragment({
      ...read,
      data: {
        reactions,
      },
    });
  });

  const fetchMessages = useCallback(
    () => paginate(GET_MESSAGES, {}, totalMessages.value),
    [GET_MESSAGES, paginate]
  );

  // 👇 multiple refs with inView. Use `useCallback` so we don't recreate the function on each render
  const setRefs = useCallback(
    (instance: HTMLDivElement | null) => {
      if (instance) {
        messageVariables.loader = instance;
      }
      // 👇 callback refs, like the one from `useInView`, is a function that takes the node as an argument
      inViewRef(instance);
    },
    [inViewRef]
  );

  // 👇 update message in cache if deleted, date sent or error sending
  const cacheUpdateMessage = useCallback(
    (
      id: string,
      status: typeof messageVariables.cache,
      createdDate?: string,
      media: string | null = null
    ) => {
      messageVariables.cache = status;
      const deleted = status === "DELETE";
      const key = deleted ? "deleted" : "createdDate";
      const value = deleted ? true : createdDate || "ERROR";

      client.cache.writeFragment({
        id: `Message:${id}`,
        fragment: gql`
        fragment Update on Message {
          ${key}
          ${media ? "media" : ""}
        }
      `,
        data: {
          [key]: value,
          media,
        },
      });
    },
    []
  );

  // 👇 add message in cache if new or sent message
  const cacheAddMessage = useCallback(
    (data: MessageType, status: typeof messageVariables.cache) => {
      messageVariables.cache = status;

      client.cache.modify({
        fields: {
          getMessages(messages: MessageType[] | null, { readField }) {
            if (!messages) {
              return messages;
            }

            // 👇 quick safety check - if the new Message is already present in the cache
            if (messages.some((ref) => readField("id", ref) === data.id)) {
              return messages;
            }

            const newMessage = client.cache.writeFragment({
              data,
              fragment: gql`
                fragment Message on Message {
                  ${gqlMessage}
                }
              `,
            });

            // 👇 add new message to existing messages in cache
            return [newMessage, ...messages];
          },
        },
        // optimistic: true,
      });
    },
    []
  );

  const SEND_MESSAGE = USE_MUTATION<MessageType>(
    "sendMessage",
    (data) => {
      const { id, createdDate, media } = data;
      // 👇 keep scroll for media after load
      messageVariables.message.id = id;

      // 👇 update offset for fetching older messages
      totalMessages.update(totalMessages.value + 1);

      // 👇 update message sent date
      cacheUpdateMessage(id, "UPDATE", createdDate, media);
    },
    (_, id) => {
      if (id) {
        // 👇 update message sent as error
        cacheUpdateMessage(id, "UPDATE");
      }
    }
  );

  const updateDate = useCallback((element: HTMLDivElement) => {
    if (!messageVariables.date.element) {
      return;
    }
    const date = element.dataset["date"];

    // 👇 update message date
    messageVariables.date.text = messageVariables.date.element.textContent =
      date !== "ERROR" && date !== "LOADING"
        ? new Date(Number(date)).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "...";
  }, []);

  // 👇 messages layout to prevent re-render
  const MessageLayout = useMemo(
    () => (
      <Flex
        ref={(element) => {
          if (element) {
            messageVariables.container = element;
          }
        }}
        direction="column"
      >
        {GET_MESSAGES.data?.map((_, index, array) => {
          // 👇 show message in reverse order
          const message = array[array.length - 1 - index];

          if (loaded === "NO") {
            // 👇 keep scroll for media after load
            messageVariables.message.id = message.id;
          }

          return (
            <Message
              // 👇 key includes properties that will likely change
              key={
                index +
                message.id +
                message.createdDate +
                message.media +
                message.deleted +
                message.missed +
                message.reactions?.[0]?.id +
                message.reactions?.[1]?.id
              }
              message={message}
              mediaLoaded={() => {
                const containerElement = container.current;
                const isNew = message.id === messageVariables.message.id;

                // 👇 criterial for scrolling to bottom of message
                if (!containerElement || !isNew) {
                  return;
                }

                const { scrollHeight, clientHeight } = containerElement;

                containerElement.scrollTo({
                  behavior: "auto",
                  top: scrollHeight - clientHeight,
                });
              }}
            />
          );
        })}
      </Flex>
    ),
    [GET_MESSAGES.data]
  );

  // 👇 load older messages initially
  useLayoutEffect(() => {
    const containerElement = container.current;
    const loader = messageVariables.loader;
    const messages = messageVariables.container?.childNodes as
      | NodeListOf<HTMLDivElement>
      | undefined;

    if (
      !containerElement ||
      !loader ||
      !messages ||
      loaded === "YES" ||
      showVideo
    ) {
      return;
    }

    const { scrollHeight, clientHeight } = containerElement;
    const top = scrollHeight - clientHeight;

    // 👇 update offset for fetching older messages
    totalMessages.update(GET_MESSAGES.data?.length || 0);

    // 👇 always fetch older message when no error and not fetched all and scrollbars is not visible
    if (!finished && top < loader.clientHeight) {
      if (error) {
        // 👇 reset message view opacity style
        updateStyle(containerElement, {
          opacity: "1",
        });
      } else {
        fetchMessages();
      }
      return;
    }

    // 👇 monitor scroll to bottom
    const scrollCheck = window.setInterval(() => {
      const { scrollHeight, clientHeight, scrollTop } = containerElement;

      const bottom = scrollHeight - scrollTop - clientHeight;

      // 👇 keep scrolling if scroll is not close to bottom
      if (bottom > 3) {
        containerElement.scrollTo({
          behavior: "smooth",
          top: scrollHeight - clientHeight,
        });
      } else {
        const { length } = messages;
        if (length) {
          // 👇 update last message for scrolling offset on loading older messages
          lastMessage.update(messages[0].dataset["id"]);

          // 👇 update message date using last message
          updateDate(messages[length - 1]);
        }
        // 👇 reset message view style to enable interaction
        updateStyle(containerElement, {
          opacity: "1",
          pointerEvents: "unset",
        });
        // 👇 clear interval
        window.clearInterval(scrollCheck);
        setLoaded("YES");
      }
    }, 500);

    // 👇 clear interval on unmount
    return () => window.clearInterval(scrollCheck);
  }, [loaded, showVideo, finished, GET_MESSAGES.data?.length]);

  // 👇 load older messages pagination
  useLayoutEffect(() => {
    if (loaded === "NO" || finished || !inView) {
      return;
    }
    fetchMessages();
  }, [inView]);

  // 👇 message change handler
  useLayoutEffect(() => {
    const containerElement = container.current;
    const messages = messageVariables.container?.childNodes as
      | NodeListOf<HTMLDivElement>
      | undefined;
    if (loaded === "NO" || !messages || !containerElement) {
      return;
    }

    // 👇 observer for updating the  tag showing message date
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) {
            updateDate(target as HTMLDivElement);
          }
        });
      },
      {
        threshold: 1,
      }
    );

    messages.forEach((child) => observer.observe(child));

    const { cache } = messageVariables;

    if (cache === "UPDATE") {
      const { scrollHeight, clientHeight } = containerElement;

      // 👇 update scroll after a message update
      containerElement.scrollTo({
        behavior: "auto",
        top: scrollHeight - clientHeight,
      });
    }

    // 👇 delete cache variable after processing
    if (cache === "UPDATE" || cache === "DELETE") {
      delete messageVariables.cache;
    }

    // 👇 clear observers on unmount
    return () => observer.disconnect();
  }, [GET_MESSAGES.data]);

  // 👇 total count of messages change handler
  useLayoutEffect(() => {
    const containerElement = container.current;
    if (loaded === "NO" || !containerElement) {
      return;
    }

    const { cache } = messageVariables;

    if (cache === "NEW" || cache === "SEND") {
      const { scrollHeight, clientHeight } = containerElement;

      // 👇 update scroll after new or sent message
      containerElement.scrollTo({
        behavior: "auto",
        top: scrollHeight - clientHeight,
      });

      if (cache === "SEND") {
        testObserver("SEND_MESSAGE");
        // 👇 send message
        SEND_MESSAGE.mutate({
          variables: {
            messageInput: messageVariables.message,
          },
        });
      } else {
        // 👇 update offset for fetching older messages
        totalMessages.update(totalMessages.value + 1);
      }

      // 👇 delete cache variable after processing
      delete messageVariables.cache;
    } else {
      // 👇 prevents scrolling back to last bottom message
      delete messageVariables.message.id;

      const loader = messageVariables.loader;
      const messages = messageVariables.container?.childNodes as
        | NodeListOf<HTMLDivElement>
        | undefined;

      const length = messages?.length;
      if (!length || !loader) {
        return;
      }

      // 👇 get last message before fetching older messages
      for (let i = 0; i < length; i++) {
        const messageId = messages[i].dataset["id"];
        if (messageId !== lastMessage.value) {
          continue;
        }
        // 👇 update offset for fetching older messages
        totalMessages.update(totalMessages.value + i);

        const scrollElement = messages[i - 1];
        // 👇 update scroll to last message stored
        containerElement.scrollTop =
          scrollElement.offsetTop + loader.clientHeight;

        // 👇 update message date using last message stored
        updateDate(scrollElement);
        // 👇 update last message for scrolling offset on loading older messages
        lastMessage.update(messages[0].dataset["id"]);

        return;
      }
    }
  }, [GET_MESSAGES.data?.length]);

  useEffect(() => {
    // 👇 reset query and errors on switch to video call
    if (showVideo) {
      reset();
    } else if (loaded === "YES") {
      // 👇 reloads messages
      setLoaded("RESET");
    }
  }, [showVideo]);

  useLayoutEffect(() => {
    setShowVideo(Boolean(answer));
    // 👇 get follow count for the user chatting with when all messages is loaded
    if (finished) {
      FOLLOW_COUNT.fetch();
    }
  }, [answer, finished]);

  return (
    <>
      <Container
        data-testid="chat-container"
        ref={container}
        border
        position="static"
        margin={theme.spacing.bottom("0.5em")}
        onScroll={() => {
          const containerElement = container.current;
          const messageDateElement = messageVariables.date.element;
          if (loaded === "NO" || !containerElement || !messageDateElement) {
            return;
          }

          // 👇 interval for hiding and displaying message date

          window.clearTimeout(messageVariables.date.styleTimeOut);

          updateStyle(messageDateElement, {
            opacity: "1",
            margin: "2em",
            pointerEvents: "unset",
          });

          messageVariables.date.styleTimeOut = window.setTimeout(
            () =>
              updateStyle(messageDateElement, {
                opacity: "0",
                margin: "0",
                pointerEvents: "none",
              }),
            secsToMs(3)
          );
        }}
      >
        <MessageDate
          data-testid="chat-date"
          transition
          ref={(element) => {
            if (element) {
              messageVariables.date.element = element;
            }
          }}
        >
          {messageVariables.date.text}
        </MessageDate>

        {finished ? (
          <Flex direction="column" align="center" margin="1em 0">
            <Image src={avatarUrl(chat?.id)} />
            <Flex justify="center" wrap="wrap">
              <Info>{chat?.name}</Info>
              <Info dim>@{chat?.username}</Info>
            </Flex>
            <Flex justify="center">
              {FOLLOW_COUNT.loading ? (
                <Spinner />
              ) : (
                <Info>{FOLLOW_COUNT.data?.following}</Info>
              )}

              <Info dim>Following</Info>
              {FOLLOW_COUNT.loading ? (
                <Spinner />
              ) : (
                <Info>{FOLLOW_COUNT.data?.followers}</Info>
              )}
              <Info dim>Followers</Info>
            </Flex>
            <Info data-testid="chat-joined-date">
              🗓
              <>&nbsp;&nbsp;</>
              Joined
              <>&nbsp;</>
              {new Date(Number(chat?.createdDate)).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </Info>
          </Flex>
        ) : (
          <Flex ref={setRefs} justify="center" padding="1em">
            {error ? <Error>{error} </Error> : <Spinner />}
          </Flex>
        )}

        {MessageLayout}
      </Container>
      <Attachment
        wsKey="chat"
        category="MESSAGE"
        sendTip="Send"
        sendClick={(input, id) => {
          if (!user) {
            return;
          }

          messageVariables.message.id = id;
          messageVariables.message.body = input.value;

          input.setValue("");

          const message: MessageType = {
            __typename: "Message",
            id: messageVariables.message.id!,
            body: messageVariables.message.body,
            deleted: false,
            media: null,
            missed: false,
            createdDate: "LOADING",
            reactions: [],
            from: {
              __typename: "User",
              username: user.username,
              auth: user.auth,
              id: user.id,
              name: user.name,
              active: user.active,
              createdDate: user.createdDate,
            },
            to: {
              __typename: "User",
              id: chat?.id,
            },
            type: "NEW_MESSAGE",
          };

          // 👇 add message to send in cache
          cacheAddMessage(message, "SEND");
        }}
        inputProps={{
          placeholder: "Start a new message",
          valueChange: (value) => {
            testObserver("TYPING");
            ws?.send(
              // 👇 send typing status to the other user
              constructMessage({
                type: "TYPING",
              })
            );
          },
          loading: loaded === "NO",
          emojiProp: {
            iconInsideInput: true,
            position: "top",
          },
          alignCenter: true,
          lines: 3,
        }}
      />
    </>
  );
};

export default Chat;
