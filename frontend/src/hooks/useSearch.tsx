// 👇 React
import { useState, useLayoutEffect } from "react";
// 👇 Components
import { Spinner } from "../components/Loader";
import Notify from "../components/Notify";
// 👇 Styles
import { Flex, List } from "../styles/Containers";
import { Text, Error } from "../styles/Text";
// 👇 Custom hooks
import { USE_QUERY } from "./useApollo";
// 👇 Constants, Helpers & Types
import { UserSub } from "../utils/types";
import { authPath, avatarUrl, testObserver } from "../utils/helpers";

export const useSearch = ({
  onClick, // a search result clicked
  link, // is search result a route
  props, // this component additional properties
}: Partial<{
  onClick: (user: UserSub) => void;
  link: boolean;
  props: typeof List.defaultProps;
}>) => {
  const [search, setSearch] = useState("");

  const FIND_USER = USE_QUERY<UserSub[]>(false, "findUser");

  useLayoutEffect(() => {
    if (search) {
      testObserver("FIND_USER");
      FIND_USER.fetch({
        variables: {
          handle: search,
        },
      });
    }
  }, [search]);

  return {
    component: (
      <List
        index={1}
        position="absolute"
        max={{
          height: "200px",
        }}
        width="95%"
        border={{
          radius: "5px",
          width: "2px",
        }}
        height="unset"
        background="blurMax"
        {...props}
      >
        {FIND_USER.data?.length ? (
          FIND_USER.data.map((user) => (
            <Notify
              testId={`find-user-${user.id}`}
              key={user.id}
              profile={{
                size: "30px",
                src: avatarUrl(user.id),
              }}
              row={{
                padding: "0.25em",
                hover: true,
                click: () => {
                  setSearch("");
                  onClick?.(user);
                },
                link: link ? authPath(user) : undefined,
              }}
              message={{
                text: user.name,
                subText: "@" + user.username,
              }}
            />
          ))
        ) : (
          <Flex padding="0.5em 0" align="center" justify="center">
            {FIND_USER.loading ? (
              <Spinner />
            ) : FIND_USER.error ? (
              <Error>{FIND_USER.error}</Error>
            ) : (
              <Text>No user found.</Text>
            )}
          </Flex>
        )}
      </List>
    ),
    search: {
      value: search,
      update: setSearch,
    },
  };
};
