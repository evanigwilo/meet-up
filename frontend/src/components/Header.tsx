// 👇 React
import {
  useState,
  useLayoutEffect,
  useRef,
  ComponentProps,
  useMemo,
} from "react";
// 👇 React Router
import { useNavigate } from "react-router-dom";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Styles
import { CalligraffittiCSS } from "../styles/Font";
import { Flex, ToolTip } from "../styles/Containers";
import { Text } from "../styles/Text";
import { Anchor } from "../styles/Anchor";
// 👇 Components
import { Spinner } from "./Loader";
import Conversations from "./Conversations";
import Notifications from "./Notifications";
import SearchInput from "./SearchInput";
import Alert from "./Alert";
// 👇 Icons
import {
  BellIcon,
  MessengerIcon,
  PersonIcon,
  BoxArrowRightIcon,
  BoxArrowInRightIcon,
} from "./Icons";
// 👇 Custom hooks
import { useWsMessage } from "../hooks/useWsMessage";
import { useSearch } from "../hooks/useSearch";
import { USE_MUTATION, USE_SUBSCRIPTION } from "../hooks/useApollo";
// 👇 Context
import { useDispatch, useStore } from "../providers/context";
import { useWs } from "../providers/ws";
// 👇 Services
import dayjs from "../services/dayjs";
// 👇 Constants, Helpers & Types
import {
  authPath,
  constructMessage,
  navigationLink,
  testObserver,
} from "../utils/helpers";
import { UserType } from "../utils/types";
import { ActionType } from "../utils/types/enum";
import {
  ConversationsType,
  KeyValue,
  MessageType,
  NotificationType,
} from "../utils/types";
import { SEO } from "../utils/constants";

const Title = styled(Text)`
  ${CalligraffittiCSS}
  cursor: pointer;
  white-space: nowrap;
  /* width: 100%; */
  &:before {
    content: "${SEO.title}";
  }
  padding: 0.5em;
  /* mobile */
  @media (max-width: 575px) {
    text-align: center;
    width: unset;
    &:before {
      content: "${SEO.logo}";
      font-size: xx-large;
    }
  }
`;

const NavIcons = styled(Flex)`
  // 👇 all children except last child
  & > div:not(:last-child) {
    margin-right: 0.5em;
  }
`;

const Header = ({ messenger }: { messenger?: boolean }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, authenticating, chat } = useStore();
  const dispatch = useDispatch();
  const ws = useWs();
  const [showConversation, setShowConversation] = useState(messenger);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAlert, setShowAlert] = useState<ComponentProps<
    typeof Alert
  > | null>(null);
  const header = useRef<HTMLDivElement | null>(null);

  const LOG_OUT = USE_MUTATION<boolean>("logout");

  USE_SUBSCRIPTION<NotificationType>("notification", (data) => {
    const { id, identifier, type, from, createdDate, viewed } = data;

    // 👇 update notifications seen
    dispatch(ActionType.UPDATE_NOTIFICATION, type === "VIEWED" ? -viewed : 1);

    // 👇 return if user notification is set to hidden or incoming video call alert is visible
    if (!user?.notification || showAlert?.type === "CALL") {
      return;
    }

    switch (type) {
      case "POST_LIKE":
      case "POST_CREATE":
      case "FOLLOWING_YOU":
      case "PROFILE_UPDATE":
        setShowAlert({
          id,
          type,
          name: from.name,
          profile: from.id,
          subText: dayjs(Number(createdDate)).fromNow(),
          // 👇 navigate to the notification link and hide alert
          onClick: () => {
            navigationLink(navigate, type, identifier);
            setShowAlert(null);
          },
          onHide: () => {
            setShowAlert(null);
          },
        });
        break;

      default:
        break;
    }
  });

  USE_SUBSCRIPTION<ConversationsType>("conversations", (data) => {
    const { unseen, update, from } = data;

    const chatting = chat?.id === from;
    const neutral = !chatting && !update;

    if (neutral || update) {
      dispatch(ActionType.UPDATE_CONVERSATION, unseen);
    } else if (chatting) {
      // 👇 if chatting set this conversation to seen
      ws?.send(
        constructMessage({
          type: "SEEN_CONVERSATION",
          content: from,
        })
      );
    }
  });

  USE_SUBSCRIPTION<MessageType>("message", (data) => {
    const { from, createdDate, id, type } = data;

    const chatting = chat?.id === from.id;

    // 👇 if not chatting user from subscription message or its a new message subscription
    if (!chatting && type === "NEW_MESSAGE") {
      setShowAlert({
        id,
        type,
        name: from.name,
        profile: from.id,
        subText: dayjs(Number(createdDate)).fromNow(),
        onClick: () => {
          setShowConversation(true);
          setShowAlert(null);
        },
        onHide: () => {
          setShowAlert(null);
        },
      });
    }
  });

  useWsMessage(
    ({ type, content, from }) => {
      if (type === "CALL_OFFER") {
        const { name, signal } = content as KeyValue;
        setShowAlert({
          id: "call",
          type: "CALL",
          profile: from,
          name,
          onAccept: () => {
            dispatch(ActionType.ANSWER, {
              signal,
              from,
              name,
            });

            const chatting = chat?.id === from;
            // 👇 if not chatting set caller info to be shown
            if (!chatting) {
              const caller: Partial<UserType> = {
                id: from,
                name,
              };
              dispatch(ActionType.CHAT, caller);
            }
            setShowConversation(true);
            setShowAlert(null);
          },
          onDecline: () => {
            testObserver("USER_BUSY");

            ws?.send(
              constructMessage({
                type: "USER_BUSY",
              })
            );
            setShowAlert(null);
          },
          onHide: () => {
            setShowAlert(null);
          },
        });
        // 👇 hide alert if call canceled or incoming video call alert is showing
      } else if (type === "CALL_CANCELED" && showAlert?.type === "CALL") {
        setShowAlert(null);
      }
    },
    [chat, showAlert, ws]
  );

  // 👇 prevent messenger from re-render when context causes re-render
  const memoConversation = useMemo(
    () => <Conversations onClose={() => setShowConversation(false)} />,
    []
  );

  // 👇 messenger routing handler
  useLayoutEffect(() => {
    if (showConversation && !messenger) {
      navigate("/messenger");
    } else if (!showConversation) {
      // 👇 clear chatting user if messenger is hidden
      dispatch(ActionType.CHAT, null);

      if (messenger) {
        navigate("/");
      }
    }
  }, [showConversation]);

  // 👇 messenger routing handler
  useLayoutEffect(() => {
    if (messenger && !showConversation) {
      setShowConversation(true);
    } else if (!messenger && showConversation) {
      setShowConversation(false);
    }
  }, [messenger]);

  // 👇 user search component
  const findUser = useSearch({
    props: {
      left: "0.5em",
      top: "95%",
    },
    link: true,
  });

  // 👇 notification badge formatter
  const notificationBadge = useMemo(() => {
    if (user) {
      const { conversations, notifications } = user;

      return {
        message: conversations > 99 ? "99+" : conversations || undefined,
        notifications: notifications > 99 ? "99+" : notifications || undefined,
      };
    } else {
      return {
        message: "",
        notifications: "",
      };
    }
  }, [user?.notifications, user?.conversations]);

  return (
    <Flex
      ref={header}
      index={2}
      align="center"
      justify="space-around"
      position="sticky"
      filter={theme.blur.min}
      top="0"
    >
      <Anchor
        to="/"
        overflow="unset"
        onClick={() =>
          window.scroll({
            behavior: "smooth",
            top: 0,
          })
        }
      >
        <Title font="x-large" bold paragraph />
      </Anchor>
      <Flex justify="center">
        <SearchInput
          margin="1em 0.5em"
          valueChanged={(value) => {
            findUser.search.update(value.trim());
          }}
          placeholder={`Search ${SEO.title}`}
        />

        {findUser.search.value && findUser.component}
      </Flex>

      <NavIcons align="center" justify="flex-end" width="unset" padding="0.5em">
        {authenticating ? (
          <Spinner />
        ) : (
          <>
            {/*
            <ToolTip
              align="center"
              border
            >
              <Grid3x3GapFillIcon />
            </ToolTip> 
          */}
            {user && (
              <>
                <ToolTip
                  data-testid="notifications"
                  align="center"
                  data-total={notificationBadge.notifications}
                  badge={notificationBadge.notifications}
                  tip="Notifications"
                  border
                  onClick={() => {
                    setShowConversation(false);
                    setShowNotifications(!showNotifications);
                  }}
                >
                  <BellIcon />
                </ToolTip>
                <ToolTip
                  data-testid="messages"
                  align="center"
                  data-total={notificationBadge.message}
                  badge={notificationBadge.message}
                  tip="Messages"
                  border
                  onClick={() => {
                    setShowNotifications(false);
                    setShowConversation(!showConversation);
                  }}
                >
                  <MessengerIcon />
                </ToolTip>
                <ToolTip align="center" tip="Profile" border>
                  <Anchor to={authPath(user)}>
                    <PersonIcon />
                  </Anchor>
                </ToolTip>
              </>
            )}

            <ToolTip
              tip={user ? "Log out" : "Login"}
              align="center"
              border
              onClick={async () => {
                if (!user) {
                  return;
                }

                dispatch(ActionType.AUTHENTICATING);

                testObserver("LOG_OUT");
                // 👇 logout user
                await LOG_OUT.mutate();

                // 👇 clear user in context
                dispatch(ActionType.AUTHENTICATED, undefined);

                // 👇  reload page
                navigate(0);
              }}
            >
              {user ? (
                <BoxArrowRightIcon data-testid="logout" />
              ) : (
                <Anchor to="/login">
                  <BoxArrowInRightIcon />
                </Anchor>
              )}
            </ToolTip>
          </>
        )}
      </NavIcons>

      {showConversation && memoConversation}

      {showNotifications && (
        <Notifications onHide={() => setShowNotifications(false)} />
      )}

      {showAlert && <Alert {...showAlert} />}
    </Flex>
  );
};
export default Header;
