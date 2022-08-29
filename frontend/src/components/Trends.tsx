// 👇 React
import { useRef, useLayoutEffect } from "react";
// 👇 Styled Component
import styled from "styled-components";
// 👇 Styles
import { Text } from "../styles/Text";
// 👇 Components
import Notify from "./Notify";
// 👇 Numeral
import numeral from "numeral";
// 👇 Constants, Helpers & Types
import { shuffleArray, updateStyle } from "../utils/helpers";
import { trends } from "../utils/constants";

const Container = styled.div`
  position: relative;
  transition: all 0.5s;
  margin-left: 1.5em;
  width: 25%;
  display: none;
  /* 
    Medium devices (tablets, 768px and up)
  */
  @media screen and (min-width: 768px) {
    display: block;
  }
`;

const Trends = () => {
  const container = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const handleScroll = () =>
      updateStyle(container.current, {
        top: window.scrollY + "px",
      });

    window.addEventListener("scroll", handleScroll, { passive: true });

    // 👇 remove scroll listener on unmount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Container ref={container}>
      <Text bold font="x-large" padding="0.25em" paragraph>
        Trends
      </Text>
      {shuffleArray(trends).map((trend, index) => (
        <Notify
          testId={`trends-${trend}`}
          key={index}
          row={{
            hover: true,
            padding: "0.5em 0",
          }}
          message={{
            text: trend,
            // 👇 10 ** 4 => 10^4
            subText: numeral(Math.random() * 10 ** 4).format("0,0") + " posts",
          }}
        />
      ))}
    </Container>
  );
};
export default Trends;
