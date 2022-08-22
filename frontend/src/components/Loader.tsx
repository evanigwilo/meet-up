/*
  https://loading.io/css/
*/

// 👇 Styled Component
import styled, { keyframes, useTheme } from "styled-components";
// 👇 Styles
import { Flex } from "../styles/Containers";

const animOpacitySpinner = keyframes`
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  `;

const LoadSpinner = styled.div`
  cursor: progress;
  color: white;
  display: inline-block;
  position: relative;
  /* transform: scale(0.25); */
  --dimension: 1.5em;
  --velocity: 0.5;
  --origin: calc(var(--dimension) / 2);
  width: var(--dimension);
  height: var(--dimension);

  div {
    transform-origin: var(--origin) var(--origin);
    animation: ${animOpacitySpinner} calc(1.2s * var(--velocity)) infinite;
  }
  div:after {
    content: " ";
    display: block;
    position: absolute;
    top: calc(var(--dimension) * 3 / 80);
    left: calc(var(--dimension) * 37 / 80);
    width: calc(var(--dimension) * 6 / 80);
    height: calc(var(--dimension) * 18 / 80);
    border-radius: 20%;
    background: #fff;
  }
  div:nth-child(1) {
    transform: rotate(0deg);
    animation-delay: calc(-1.1s * var(--velocity));
  }
  div:nth-child(2) {
    transform: rotate(30deg);
    animation-delay: calc(-1s * var(--velocity));
  }
  div:nth-child(3) {
    transform: rotate(60deg);
    animation-delay: calc(-0.9s * var(--velocity));
  }
  div:nth-child(4) {
    transform: rotate(90deg);
    animation-delay: calc(-0.8s * var(--velocity));
  }
  div:nth-child(5) {
    transform: rotate(120deg);
    animation-delay: calc(-0.7s * var(--velocity));
  }
  div:nth-child(6) {
    transform: rotate(150deg);
    animation-delay: calc(-0.6s * var(--velocity));
  }
  div:nth-child(7) {
    transform: rotate(180deg);
    animation-delay: calc(-0.5s * var(--velocity));
  }
  div:nth-child(8) {
    transform: rotate(210deg);
    animation-delay: calc(-0.4s * var(--velocity));
  }
  div:nth-child(9) {
    transform: rotate(240deg);
    animation-delay: calc(-0.3s * var(--velocity));
  }
  div:nth-child(10) {
    transform: rotate(270deg);
    animation-delay: calc(-0.2s * var(--velocity));
  }
  div:nth-child(11) {
    transform: rotate(300deg);
    animation-delay: calc(-0.1s * var(--velocity));
  }
  div:nth-child(12) {
    transform: rotate(330deg);
    animation-delay: 0s;
  }
`;

const animSizingBars = keyframes`
    0% {
    top: calc(var(--dimension) * 8 / 80);
    height: calc(var(--dimension) * 64 / 80);
  }
    50%, 100% {
      top: calc(var(--dimension) * 24 / 80);
      height: calc(var(--dimension) * 32 / 80);
    }
  `;

const LoadBars = styled.div`
  cursor: progress;
  color: white;
  display: inline-block;
  position: relative;
  overflow: hidden;
  /* transform: scale(0.25); */
  --dimension: 20px;
  --velocity: 1;
  width: var(--dimension);
  height: var(--dimension);

  div {
    display: inline-block;
    position: absolute;
    width: calc(var(--dimension) * 16 / 80);
    left: calc(var(--dimension) * 8 / 80);
    background: #fff;
    animation: ${animSizingBars} calc(1.2s * var(--velocity))
      cubic-bezier(0, 0.5, 0.5, 1) infinite;
  }
  div:nth-child(1) {
    left: calc(var(--dimension) * 8 / 80);
    animation-delay: -0.24s;
    animation-delay: calc(-0.12s * var(--velocity));
  }
  div:nth-child(2) {
    left: calc(var(--dimension) * 32 / 80);
    animation-delay: calc(-0.12s * var(--velocity));
  }
  div:nth-child(3) {
    left: calc(var(--dimension) * 56 / 80);
    animation-delay: calc(0 * var(--velocity));
  }
`;

const animOpacityPlaceholder = keyframes`
0% {
  opacity: 0.7;
}
100% {
  opacity: 0.4;
}
`;

const LoadPlaceholder = styled(Flex)<{ radius?: string; grow?: number }>`
  flex-grow: ${({ grow }) => grow || "unset"};
  width: ${({ width }) => width || "unset"};
  border-radius: ${({ radius }) => radius || "50%"};
  background: rgb(164 175 191 / 0.56);
  /* pointer-events: none; */
  cursor: progress;
  opacity: 0.7;
  animation: ${animOpacityPlaceholder};
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-duration: 1s;
`;

export const Spinner = () => {
  /*
    return (
      <p
        style={{
          color: "white",
        }}
      >
        Loading...
      </p>
    );
  */

  return (
    <LoadSpinner>
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index}></div>
      ))}
    </LoadSpinner>
  );
};

export const Bars = () => {
  return (
    <LoadBars data-testid="bars">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index}></div>
      ))}
    </LoadBars>
  );
};

export const PlaceHolder = ({ length }: { length: number }) => {
  const theme = useTheme();
  return (
    <>
      {Array.from({ length }).map((_, index) => (
        <Flex key={index} padding="1em" align="center">
          <LoadPlaceholder width="48px" height="48px" />
          <LoadPlaceholder
            radius="25px"
            height="20px"
            grow={1}
            margin={theme.spacing.left("0.5em")}
          />
        </Flex>
      ))}
    </>
  );
};
