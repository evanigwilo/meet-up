// 👇 React
import { useState, useRef, useLayoutEffect, useCallback } from "react";
// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 Styled Component
import { useResize } from "../hooks/useResize";
// 👇 Context
import { useDispatch, useStore } from "../providers/context";
// 👇 Styles
import { Flex } from "../styles/Containers";
import { Text } from "../styles/Text";
// 👇 Components
import { Spinner } from "./Loader";
// 👇 Constants, Helpers & Types
import { isMimeType, updateStyle } from "../utils/helpers";
import { ActionType } from "../utils/types/enum";

const MediaType = ({
  src, // image source
  mimeType,
  afterLoad, // after image loads callback
}: {
  src: string;
  mimeType: string;
  afterLoad?: () => void;
}) => {
  const theme = useTheme();
  const { media } = useStore();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const image = useRef<HTMLImageElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const spinner = useRef<HTMLDivElement | null>(null);

  const updateDimensions = useCallback(() => {
    if (loading) {
      return;
    }
    const spinnerElement = spinner.current;
    const mediaElement = image.current || video.current || audio.current;

    if (spinnerElement && mediaElement) {
      // 👇 hide spinner
      spinnerElement.classList.replace("show", "hide");
      // 👇 for smooth update of post reply threads, set dimensions of image after visible
      mediaElement.hidden = false;

      let height = "";
      let width = "";

      updateStyle(mediaElement, {
        height,
        width,
      });
      updateStyle(spinnerElement, {
        height,
        width,
      });

      const { clientWidth, clientHeight } = mediaElement;
      height = clientHeight + "px";
      width = clientWidth + "px";

      updateStyle(mediaElement, {
        height,
        width,
      });
      updateStyle(spinnerElement, {
        height,
        width,
      });
    }

    afterLoad?.();
  }, [loading]);

  useLayoutEffect(() => updateDimensions(), [loading]);

  useLayoutEffect(() => {
    // 👇 pause all currently playing media when user plays a media
    if (media && media !== src) {
      video.current?.pause();
      audio.current?.pause();
    }
  }, [media]);

  useResize(() => updateDimensions());

  const mediaLoaded = () => setLoading(false);

  return (
    <>
      {isMimeType("image", mimeType) ? (
        <img
          alt="image-source"
          ref={image}
          src={src}
          hidden
          onLoad={() => mediaLoaded()}
        />
      ) : isMimeType("video", mimeType) ? (
        <video
          ref={video}
          hidden
          playsInline
          controls
          disablePictureInPicture
          onLoadedMetadata={() => mediaLoaded()}
          onPlay={() =>
            // 👇 sets current media playing so as to stop all other playing media
            dispatch(ActionType.PLAYING, src)
          }
          controlsList="noplaybackrate nodownload nofullscreen"
          //   muted="muted"
          //   autoplay
        >
          <source src={src} type={mimeType} />
        </video>
      ) : (
        isMimeType("audio", mimeType) && (
          <audio
            ref={audio}
            hidden
            controls
            onLoadedMetadata={() => mediaLoaded()}
            onPlay={() =>
              // 👇 sets current media playing so as to stop all other playing media
              dispatch(ActionType.PLAYING, src)
            }
          >
            <source src={src} type={mimeType} />
            {/* Your browser does not support the audio element. */}
          </audio>
        )
      )}

      <div ref={spinner} className="spinner show">
        <Flex width="unset" direction="column" align="center">
          <Spinner />
          <Text
            className="percent"
            font="smaller"
            padding={theme.spacing.top("0.25em")}
          />
        </Flex>
      </div>
    </>
  );
};

export default MediaType;
