// 👇 React
import { useLayoutEffect } from "react";
// 👇 Styled Component
import styled from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, List } from "../styles/Containers";
import { Anchor } from "../styles/Anchor";
// 👇 Constants, Helpers & Types
import { SEO } from "../utils/constants";

const Background404 = styled(Text)`
  /* position: absolute; */
  font-size: 12em;
  opacity: 0.1;
  letter-spacing: 0.1em;
  margin-left: 0.1em;

  :after {
    content: "404";
  }
`;

const NotFound = () => {
  // 👇 page title
  useLayoutEffect(() => {
    document.title = `Page not found • ${SEO.title}`;
  }, []);

  return (
    <List
      align="center"
      // justify="center"
      position="fixed"
      padding="10em 0.5em"
      left="0"
      top="0"
    >
      <Background404 />
      <Text padding="1em 0" bold font="1.5em">
        Sorry, this page isn't available.
      </Text>

      <Text font="1.2em" align="center">
        The link you followed may be broken, or the page may have been removed.
      </Text>

      <Flex padding="0.5em 0" align="center" justify="center">
        <Text font="1.2em">Go back to</Text>
        <Anchor to={"/"}>
          <Text hover={true} font="1.2em" dim bold>
            &nbsp;{`${SEO.title}.`}
          </Text>
        </Anchor>
      </Flex>
    </List>
  );
};
export default NotFound;
