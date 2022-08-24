// 👇 React
import { useCallback, useEffect, useRef, useState } from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Styles
import { Flex, ToolTip } from "../styles/Containers";
import { Text } from "../styles/Text";
import { CallIcon } from "./Icons";
// 👇 Components
import Notify from "./Notify";
// 👇 Custom hooks
import { useReference } from "../hooks/useReference";
// 👇 Constants, Helpers & Types
import { MessageType, NotificationType } from "../utils/types";
import { avatarUrl, secsToMs, updateStyle } from "../utils/helpers";

const Container = styled(Flex)`
  --width: 65%;
  position: absolute;
  top: 3em;
  right: 1em;
  max-width: 500px;
  transition: all 0.5s ease-in;
  width: var(--width);
  margin-right: calc(-1 * var(--width));
  opacity: 0;
  pointer-events: none;

  /* mobile */
  @media (max-width: 575px) {
    --width: 80%;
  }
`;

const Alert = (props: {
  type: "CALL" | MessageType["type"] | NotificationType["type"];
  id: string; // identifies when alert changes to update
  profile?: string;
  name?: string;
  subText?: string;
  onAccept?: () => void; // when user accepts video call
  onDecline?: () => void; // when user declines video call
  onClick?: () => void; // when the alert is clicked
  onHide?: () => void;
}) => {
  const theme = useTheme();
  const container = useRef<HTMLDivElement | null>(null);
  const hideTimeout = useReference(0);
  const [id, setId] = useState(props.id);
  const { type, subText, profile, name, onAccept, onDecline, onClick, onHide } =
    props;

  // 👇 simulate hiding alert
  const hide = useCallback(
    () =>
      updateStyle(container.current, {
        marginRight: "calc(-1 * var(--width))",
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

    updateStyle(containerElement, {
      marginRight: "0",
      opacity: "1",
      pointerEvents: "unset",
    });

    containerElement.addEventListener("transitionend", (ev) => {
      if (ev.target === containerElement && ev.propertyName === "opacity") {
        const opacity = containerElement.style.opacity;
        if (opacity === "0") {
          onHide?.();
        } else if (opacity === "0.5") {
          updateStyle(containerElement, {
            opacity: "1",
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    window.clearTimeout(hideTimeout.value);
    hideTimeout.update(
      window.setTimeout(
        () => hide(),
        // 👇 calling alert should last longer (1 min)
        type === "CALL" ? secsToMs(60) : secsToMs(5)
      )
    );

    if (props.id === id) {
      return;
    }

    updateStyle(container.current, {
      opacity: "0.5",
    });

    setId(props.id);

    // 👇 clear timeout on unmount
    return () => window.clearTimeout(hideTimeout.value);
  }, [props.id]);

  const profileSrc = {
    src: avatarUrl(profile),
  };

  return (
    <Container
      data-testid="alert"
      ref={container}
      padding={type === "CALL" ? "1em" : "0.5em"}
      background
      align="center"
      direction="column"
      border
    >
      <ToolTip
        border
        width="0.8em"
        height="0.8em"
        tip="Close"
        tipPosition="top"
        position="absolute"
        right="-1em"
        top="-1em"
        filter={theme.blur.min}
        onClick={() => hide()}
      >
        <Text dim font="1.25em">
          ✕
        </Text>
      </ToolTip>

      {type === "CALL" ? (
        <Notify
          row={{
            backgroundLoading: true,
          }}
          message={{
            bold: true,
            text: name,
            subText: "Incoming Video Call",
          }}
          profile={profileSrc}
          element={
            <Flex
              width="unset"
              align="center"
              margin={theme.spacing.right("-0.5em")}
            >
              <CallIcon tip="Decline" onClick={onDecline} />
              <CallIcon tip="Accept" onClick={onAccept} />
            </Flex>
          }
        />
      ) : (
        <Notify
          row={{
            hover: true,
            highlight: true,
            click: onClick,
          }}
          message={{
            subText,
            format: {
              type,
              name,
            },
          }}
          profile={profileSrc}
        />
      )}
    </Container>
  );
};

export default Alert;
