// 👇 React
import { useRef, useLayoutEffect, useCallback } from "react";
// 👇 Styled Component
import styled from "styled-components";
// 👇 Styles
import { Flex, ToolTip } from "../styles/Containers";
// 👇 Context
import { useStore, useDispatch } from "../providers/context";
// 👇 Custom hooks
import { useResize } from "../hooks/useResize";
import { USE_MUTATION } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { ActionType } from "../utils/types/enum";
import { testObserver, updateProperty, updateStyle } from "../utils/helpers";

const BellContainer = styled.div<{
  transform?: string;
}>`
  --transition: unset;
  width: 3em;
  height: 1.5em;
  border-radius: 25px;
  position: relative;
  cursor: pointer;
  transition: var(--transition);
  align-self: end;
  background-color: slategray;
  box-shadow: rgb(0 0 0 / 25%) 0px 0px 0px 1px inset;
  /* mobile */
  @media (max-width: 575px) {
    font-size: smaller;
  }
`;

const Bell = styled(Flex)`
  position: absolute;
  align-items: center;
  justify-content: center;
  width: unset;
  height: 100%;
  aspect-ratio: 1;
  cursor: pointer;
  background: ghostwhite;
  border-radius: 50%;
  transition: inherit;
  box-shadow: rgb(0 0 0 / 15%) 0px 0px 0px;
`;

const translateX = (width?: number) => `translateX(calc(${width}px - 100%))`;

const Switch = () => {
  const { user } = useStore();
  const dispatch = useDispatch();
  const notification = user?.notification;
  const bell = useRef<HTMLDivElement | null>(null);
  const bellContainer = useRef<HTMLDivElement | null>(null);

  const NOTIFICATION_TOGGLE = USE_MUTATION<boolean>("toggleNotification");

  const updatePos = useCallback(
    (transition = true) => {
      updateProperty(bellContainer.current, {
        "--transition": transition ? "all 0.25s ease 0s" : "",
        "background-color": notification ? "orangered" : "slategray",
      });

      updateStyle(bell.current, {
        transform: notification
          ? translateX(bellContainer.current?.clientWidth)
          : "",
      });
    },
    [notification]
  );

  const updateIcon = useCallback(() => {
    const bellElement = bell.current;
    if (!bellElement) {
      return;
    }
    bellElement.textContent = notification ? "🔔" : "🔕";
  }, [notification]);

  useResize(() => updatePos(), false);

  useLayoutEffect(() => {
    // 👇 simulate first render by checking bell text
    const noText = !Boolean(bell.current?.textContent);

    if (noText) {
      updateIcon();
    }

    updatePos(!noText);
  }, [notification]);

  return (
    <ToolTip
      hover={false}
      tip={`${notification ? "Hide" : "Show"} Notifications`}
      tipPosition="left"
      disabled={NOTIFICATION_TOGGLE.loading}
      opacity={NOTIFICATION_TOGGLE.loading ? "dim" : 1}
    >
      <BellContainer
        ref={bellContainer}
        data-testid="notification-switch"
        onClick={async () => {
          const toggle = !notification;
          testObserver("NOTIFICATION_TOGGLE");
          const { errors } = await NOTIFICATION_TOGGLE.mutate({
            variables: {
              toggle,
            },
          });

          // 👇 toggle notification if no error
          if (!errors) {
            dispatch(ActionType.TOGGLE_NOTIFICATION, toggle);
          }
        }}
      >
        <Bell
          ref={bell}
          onTransitionEnd={() => {
            updateIcon();
            // 👇 fixes switch position after resize
            updatePos();
          }}
        />
      </BellContainer>
    </ToolTip>
  );
};

export default Switch;
