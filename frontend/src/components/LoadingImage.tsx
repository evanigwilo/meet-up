// 👇 React
import { useState, useRef, useEffect, useCallback } from "react";
// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 Components
import { Spinner } from "./Loader";
// 👇 Styles
import { Flex } from "../styles/Containers";
import Image from "../styles/Image";
import { Text } from "../styles/Text";
// 👇 Custom hooks
import { useReference } from "../hooks/useReference";
// 👇 Constants, Helpers & Types
import { secsToMs, updateStyle } from "../utils/helpers";

const LoadingImage = ({
  src, // image src
  size, // image size
  prop, // additional container properties
  onLoad, // after image loads callback
  element, // jsx element to append bottom of container
  percent,
}: {
  src: string;
  size?: string;
  prop?: typeof Flex.defaultProps;
  onLoad?: () => void;
  element?: JSX.Element;
  percent?: boolean;
}) => {
  const theme = useTheme();
  const [dimension] = useState(size || "3em");
  const container = useRef<HTMLDivElement | null>(null);
  const hideTimeOut = useReference(0);

  // 👇 hide loader
  const hideLoader = useCallback(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const loader = element.querySelector(".loader") as HTMLDivElement;
    updateStyle(loader, {
      display: "none",
    });
    const progress = element.querySelector<HTMLSpanElement>(".percent");
    if (progress) {
      progress.textContent = "";
    }

    window.clearTimeout(hideTimeOut.value);
  }, []);

  useEffect(() => {
    // 👇 hide loader after 30secs
    hideTimeOut.update(window.setTimeout(() => hideLoader(), secsToMs(30)));

    // 👇 clear timeout on unmount
    return () => window.clearTimeout(hideTimeOut.value);
  }, []);

  return (
    <Flex
      ref={container}
      direction="column"
      width="auto"
      ratio={1}
      height={dimension}
      {...prop}
    >
      <Flex
        className="loader"
        index={1}
        border={{
          radius: "50%",
          width: "0",
        }}
        direction="column"
        background="loading"
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        align="center"
        justify="center"
      >
        <Spinner />

        {percent && (
          <Text
            className="percent"
            font="smaller"
            padding={theme.spacing.top("0.25em")}
          />
        )}
      </Flex>

      <Image
        className="image"
        ratio="width"
        size="100%"
        src={src}
        onLoad={() => {
          hideLoader();
          onLoad?.();
        }}
      />

      {element}
    </Flex>
  );
};

export default LoadingImage;
