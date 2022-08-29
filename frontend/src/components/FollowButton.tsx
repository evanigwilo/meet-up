// 👇 React
import { useRef, useState } from "react";
// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, ToolTip } from "../styles/Containers";
// 👇 Components
import { Spinner } from "./Loader";
// 👇 Custom hooks
import { USE_MUTATION } from "../hooks/useApollo";
import { testObserver } from "../utils/helpers";

const FollowButton = ({
  initial, // initial value
  user,
  callback,
  properties, // styles update
}: {
  initial: "Following" | "Follow";
  user: Partial<{
    auth: string;
    username: string;
  }>;
  callback: (value: "Follow" | "UnFollow") => void;
  properties?: Partial<{
    container: typeof Flex.defaultProps;
    text: typeof Text.defaultProps;
  }>;
}) => {
  const theme = useTheme();
  const text = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(initial);
  const [variables] = useState({
    variables: {
      authInput: {
        username: user.username,
        auth: user.auth,
      },
    },
  });

  const FOLLOW_USER = USE_MUTATION<{
    followUser: boolean;
  }>("followUser");

  const UNFOLLOW_USER = USE_MUTATION<{
    unFollowUser: boolean;
  }>("unFollowUser");

  const loading = FOLLOW_USER.loading || UNFOLLOW_USER.loading;

  return loading ? (
    <Flex width="unset" {...properties?.container}>
      <Spinner />
    </Flex>
  ) : (
    <ToolTip
      data-testid={`follow-${user.auth}-${user.username}`}
      padding="0.5em"
      border={{
        radius: "0.75em",
        width: "0.125em",
      }}
      scale={1.03}
      filter={theme.blur.min}
      onMouseEnter={() => {
        const element = text.current;
        if (element) {
          element.textContent = value === "Following" ? "Unfollow?" : "Follow?";
        }
      }}
      onMouseLeave={() => {
        const element = text.current;
        if (element) {
          element.textContent = value;
        }
      }}
      onClick={async () => {
        if (value === "Following") {
          testObserver("UNFOLLOW_USER");
          const { data } = await UNFOLLOW_USER.mutate(variables);
          if (data?.unFollowUser) {
            setValue("Follow");
            callback("UnFollow");
          }
        } else if (value === "Follow") {
          testObserver("FOLLOW_USER");
          const { data } = await FOLLOW_USER.mutate(variables);
          if (data?.followUser) {
            setValue("Following");
            callback("Follow");
          }
        }
      }}
      {...properties?.container}
    >
      <Text ref={text} dim font="smaller" {...properties?.text}>
        {value}
      </Text>
    </ToolTip>
  );
};

export default FollowButton;
