// 👇 React
import { useEffect, useCallback, useRef, useLayoutEffect } from "react";
// 👇 React Router
import { useNavigate } from "react-router-dom";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Intersection Observer
import { useInView } from "react-intersection-observer";
// 👇 Styles
import { Flex, List, ToolTip } from "../styles/Containers";
import { Text } from "../styles/Text";
// 👇 Components
import Notify from "./Notify";
// 👇 Custom hooks
import { usePagination } from "../hooks/usePagination";
import { USE_QUERY } from "../hooks/useApollo";
// 👇 Services
import dayjs from "../services/dayjs";
// 👇 Constants, Helpers & Types
import { NotificationType } from "../utils/types";
import { navigationLink, avatarUrl, updateStyle } from "../utils/helpers";

const Container = styled(List)`
  position: absolute;
  right: 0.5em;
  top: 100%;
  width: 65%;
  height: 0;
  transition: all 0.5s ease-in-out;
  pointer-events: none;
  opacity: 0;

  /* mobile */
  @media (max-width: 575px) {
    width: 80%;
  }
`;

const Notifications = ({ onHide }: { onHide?: () => void }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { ref, inView } = useInView({
    initialInView: true,
  });
  const { paginate, finished, Progress } = usePagination(ref, inView);
  const container = useRef<HTMLDivElement | null>(null);

  const GET_NOTIFICATIONS = USE_QUERY<NotificationType[]>(
    true,
    "getNotifications"
  );

  // 👇 simulate hide of this component
  const hide = useCallback(
    () =>
      updateStyle(container.current, {
        height: "0",
        opacity: "0",
        pointerEvents: "none",
      }),
    []
  );

  useEffect(() => {
    const containerElement = container.current;
    if (!containerElement) {
      return;
    }

    // 👇 show this component on mount
    updateStyle(containerElement, {
      height: "80vh",
      opacity: "1",
      pointerEvents: "unset",
    });

    containerElement.addEventListener("transitionend", (ev) => {
      if (ev.target === containerElement && ev.propertyName === "opacity") {
        // 👇 hide this component if opacity is 0
        if (containerElement.style.opacity === "0") {
          onHide?.();
        }
      }
    });
  }, []);

  // 👇 load notifications pagination
  useLayoutEffect(() => {
    if (finished || !inView) {
      return;
    }

    paginate(GET_NOTIFICATIONS);
  }, [inView, GET_NOTIFICATIONS.loading]);

  return (
    <Container
      data-testid="tab-notifications"
      border
      background
      padding="1em"
      ref={container}
    >
      <Flex justify="space-between" padding="1em 0">
        <Text bold font="x-large">
          Notifications
        </Text>
        <ToolTip
          tip="Close"
          hover={false}
          tipPosition="top"
          onClick={() => hide()}
        >
          <Text data-testid="close-notifications" dim font="large">
            ✕
          </Text>
        </ToolTip>
      </Flex>

      <List border>
        {GET_NOTIFICATIONS.data?.map(
          ({ id, from, seen, createdDate, type, identifier }) => (
            <Notify
              testId={`notifications-${id}`}
              key={id}
              row={{
                hover: true,
                highlight: !seen,
                padding: "0.5em",
                margin: theme.spacing.top("0.25em"),
                // 👇 navigate to the notification link and hide this component
                click: () => {
                  navigationLink(navigate, type, identifier);
                  hide();
                },
              }}
              message={{
                format: {
                  type,
                  name: from.name,
                },
                subText: dayjs(Number(createdDate)).fromNow(),
              }}
              profile={{
                src: avatarUrl(from.id),
              }}
            />
          )
        )}

        <Progress placeholder={true} />
      </List>
    </Container>
  );
};
export default Notifications;
