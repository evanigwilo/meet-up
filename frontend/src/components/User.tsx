// 👇 React
import { useState } from "react";
// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, Row } from "../styles/Containers";
import { Anchor } from "../styles/Anchor";
// 👇 Components
import FollowButton from "./FollowButton";
import LoadingImage from "./LoadingImage";
// 👇 Constants, Helpers & Types
import { UserType } from "../utils/types";
import { authPath, avatarUrl } from "../utils/helpers";

const User = (props: {
  user: UserType;
  selection: "Following" | "Follow";
  followButton: boolean;
}) => {
  const theme = useTheme();
  const [user, setUser] = useState(props.user);
  const { selection, followButton } = props;

  return (
    <Row
      data-testid={`user-${user.id}`}
      margin={theme.spacing.top("1em")}
      align="center"
      padding="1em"
      border={{
        radius: "1em",
        width: "0",
      }}
      highlight
    >
      <LoadingImage size="4em" src={avatarUrl(user.id)} />
      <Flex direction="column" padding="0 1em" overflow="hidden">
        <Flex align="center" justify="space-between">
          <Flex
            direction="column"
            margin={theme.spacing.right("1em")}
            overflow="hidden"
          >
            <Flex align="center">
              <Anchor to={authPath(user)}>
                <Text
                  padding="0.25em 0"
                  margin={theme.spacing.right("auto")}
                  // transform="capitalize"
                  ellipsis={1}
                >
                  {user.name}
                </Text>
              </Anchor>

              {user.mutual && (
                <Text
                  data-testid={`mutual-${user.auth}-${user.username}`}
                  dim
                  border={{
                    radius: "0",
                    width: "0.25em",
                  }}
                  preserve
                  paragraph
                  font="smaller"
                  padding="0.25em"
                  margin={theme.spacing.left("1em")}
                >
                  👥 Mutual
                </Text>
              )}
            </Flex>

            <Text dim padding="0.25em 0" font="smaller" ellipsis={1}>
              {"@" + user.username}
            </Text>
          </Flex>
          {followButton && (
            <FollowButton
              initial={selection}
              user={{
                auth: user.auth,
                username: user.username,
              }}
              callback={(value) => {
                if (value === "UnFollow") {
                  // 👇 update mutual status when user stops following
                  setUser((prev) => ({
                    ...prev,
                    mutual: false,
                  }));
                }
              }}
            />
          )}
        </Flex>
        {user.bio && <Text ellipsis={2}>{user.bio}</Text>}
      </Flex>
    </Row>
  );
};

export default User;
