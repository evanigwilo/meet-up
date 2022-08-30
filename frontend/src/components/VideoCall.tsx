// 👇 React
import { useRef, useCallback, useLayoutEffect, useState } from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Styles
import { Flex, List } from "../styles/Containers";
import Image from "../styles/Image";
import { Text, Error } from "../styles/Text";
// 👇 Components
import { Bars, Spinner } from "./Loader";
// 👇 Icons
import { CallIcon } from "./Icons";
// 👇 Peer
import Peer from "simple-peer";
// 👇 Context
import { useWs } from "../providers/ws";
import { useDispatch, useStore } from "../providers/context";
// 👇 Custom hooks
import { useWsMessage } from "../hooks/useWsMessage";
// 👇 Constants, Helpers & Types
import { UserType } from "../utils/types";
import { avatarUrl, constructMessage, testObserver } from "../utils/helpers";
import { ActionType } from "../utils/types/enum";
// 👇 For simple-peer to work correctly you need some polyfills.
import * as process from "process";
(window as any).global = window;
(window as any).process = process;
(window as any).Buffer = [];

const BlurBackground = styled.div<{ bg: string }>`
  background-image: url(${({ bg }) => bg});
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  /* background-attachment: fixed; */
  width: 100%;
  height: 100%;
  filter: ${({ theme }) => `brightness(0.2) ${theme.blur.mid}`};
  pointer-events: none;
  position: absolute;
`;

const Container = styled(List)`
  margin-bottom: 0.5em;
`;

Container.defaultProps = {
  border: true,
};

// 👇 video component
const Video = styled.video.attrs(
  ({
    playsInline,
    disablePictureInPicture,
    autoPlay,
    controls,
    controlsList,
  }) => ({
    playsInline: true,
    disablePictureInPicture: true,
    autoPlay: true,
    controls: true,
    controlsList: "nodownload",
  })
)`
  position: absolute;
  width: 100%;
  height: 100%;
`;

const playStream = (
  stream: MediaStream,
  media: HTMLMediaElement | null,
  onPlay?: () => void
) => {
  if (!media) {
    return;
  }
  media.onloadedmetadata = () => {
    media.play().then(() => onPlay?.());
  };
  if ("srcObject" in media) {
    media.srcObject = stream;
  } else {
    // 👇  for older browsers
    (media as HTMLMediaElement).src = window.URL.createObjectURL(
      stream as unknown as MediaSource
    );
  }
};

const VideoCall = ({ calling }: { calling?: UserType }) => {
  const theme = useTheme();
  const { answer, user } = useStore();
  const dispatch = useDispatch();
  const ws = useWs();
  const [error, setError] = useState("");
  const [profileLink] = useState({
    caller: avatarUrl(user?.id),
    answerer: answer ? avatarUrl(answer.from) : avatarUrl(calling?.id),
  });
  // 👇 call status
  const [status, setStatus] = useState<
    | "NO ANSWER"
    | "CALL ENDED"
    | "CALL CANCELED"
    | "ANSWERING"
    | "RINGING"
    | "BUSY"
    | "OFFLINE"
    | Record<"LIVE", MediaStream>
  >(answer ? "ANSWERING" : "RINGING");
  const container = useRef<HTMLDivElement | null>(null);
  const v1 = useRef<HTMLVideoElement | null>(null);
  const v2 = useRef<HTMLVideoElement | null>(null);
  // 👇 peer props
  const { current: peers } = useRef<
    Partial<{
      caller: Peer.Instance;
      answerer: Peer.Instance;
      stream: MediaStream;
    }>
  >({});

  const AnswerProfile = useCallback(
    () => (
      <Image
        src={profileLink.answerer}
        size="50%"
        ratio="height"
        margin={theme.spacing.bottom("0.5em")}
      />
    ),
    []
  );

  const getStream = useCallback((callback: (stream: MediaStream) => void) => {
    window.navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        callback(stream);
      })
      .catch(() => {
        setError("Could not get media devices.");
      });
  }, []);

  const peerEvents = useCallback(
    (
      peer: Peer.Instance,
      src: "call" | "answer",
      onSignal: {
        type: "ANSWER_OFFER" | "CALL_OFFER";
        to?: string;
      }
    ) => {
      // 👇 signal date between peers
      peer.on("signal", (data) => {
        testObserver("PEER_SIGNAL_EVENT");

        ws?.send(
          constructMessage({
            content: data,
            ...onSignal,
          })
        );
      });

      // 👇 stream between peers
      peer.on("stream", (stream) =>
        setStatus({
          LIVE: stream,
        })
      );
      peer.on("close", () => {
        // 👇 stop both mic and camera
        peers.stream?.getTracks().forEach((track) => track.stop());

        if (src === "answer") {
          // 👇 clear answerer
          dispatch(ActionType.ANSWER, null);
        } else {
          setStatus("CALL ENDED");
        }
      });

      /*
      peer.on("end", () => {
        console.log(`peer ${src} end`);
      });
      peer.on("error", (error) => {
        console.log({ [`peer ${src} error`]: error });
      });
      */
    },
    [ws]
  );

  const callUser = useCallback(() => {
    getStream((stream) => {
      playStream(stream, v1.current, () => {
        // 👇 store caller peer props
        peers.stream = stream;
        peers.caller = new Peer({
          initiator: true,
          trickle: false,
          stream,
        });

        peerEvents(peers.caller, "call", {
          type: "CALL_OFFER",
          to: calling?.id,
        });
      });
    });
  }, []);

  const answerCall = useCallback(() => {
    getStream((stream) => {
      playStream(stream, v1.current, () => {
        // 👇 store answerer peer props
        peers.stream = stream;
        peers.answerer = new Peer({ trickle: false, stream });

        peerEvents(peers.answerer, "answer", {
          type: "ANSWER_OFFER",
          // to: answer?.from,
        });

        // 👇 signal data to caller
        peers.answerer.signal(answer!.signal);
      });
    });
  }, [ws]);

  // 👇 peer status handler
  useWsMessage(
    ({ type, content }) => {
      if (type === "ANSWER_OFFER") {
        peers.caller?.signal(content as Peer.SignalData);
      } else if (type === "USER_OFFLINE") {
        setStatus("OFFLINE");
      } else if (!answer) {
        if (type === "NO_ANSWER") {
          setStatus("NO ANSWER");
        } else if (type === "USER_BUSY") {
          setStatus("BUSY");
        } else if (type === "UNAUTHENTICATED") {
          setError("User not authenticated.");
        }
      }
    },
    [answer]
  );

  useLayoutEffect(() => {
    const containerElement = container.current;
    if (!containerElement) {
      return;
    }
    // 👇 call or answer user
    if (answer) {
      answerCall();
    } else {
      callUser();
    }

    // 👇 destroy the peer on unmount
    return () => (answer ? peers.answerer?.destroy() : peers.caller?.destroy());
  }, []);

  useLayoutEffect(() => {
    if (error) {
      // 👇 destroy the peer on error
      peers.caller?.destroy();
    } else if (typeof status === "object") {
      playStream(status.LIVE, v2.current);
    } else if (
      status === "OFFLINE" ||
      status === "NO ANSWER" ||
      status === "CALL CANCELED" ||
      status === "BUSY"
    ) {
      // 👇 stop both mic and camera
      peers.stream?.getTracks().forEach((track) => track.stop());
    }
  }, [status, error]);

  return (
    <List ref={container}>
      <Container justify="space-between">
        <BlurBackground data-testid="call-background" bg={profileLink.caller} />
        <Video data-testid="video-call" ref={v1} muted />
        {error && (
          <Error data-testid="error" margin="auto">
            {error}
          </Error>
        )}
      </Container>
      <br />
      <Container>
        <BlurBackground
          data-testid="answer-background"
          bg={profileLink.answerer}
        />
        {/* ringing */}
        {status === "RINGING" && (
          <List align="center" margin="1em 0">
            <AnswerProfile />
            <Text padding="0.25em">{calling?.name}</Text>
            <Text dim font="smaller" padding="0.25em">
              Calling...
            </Text>

            <Bars />
          </List>
        )}
        {status === "ANSWERING" && (
          <List align="center" margin="1em 0">
            <AnswerProfile />
            <Text padding="0.5em">{answer?.name}</Text>
            <Spinner />
          </List>
        )}
        {(status === "CALL ENDED" ||
          status === "CALL CANCELED" ||
          status === "NO ANSWER" ||
          status === "OFFLINE" ||
          status === "BUSY") && (
          <List align="center" margin="1em 0">
            <AnswerProfile />
            <Text padding="0.25em">{calling?.name}</Text>
            <Text data-testid="status" dim font="smaller" padding="0.25em">
              {status}
            </Text>
          </List>
        )}
        {/* No answer. */}
        {/* Call ended. */}
        {/* Ended */}
        {/* Live */}
        {typeof status === "object" && (
          <Video data-testid="video-answer" ref={v2} />
        )}
        {(typeof status === "object" ||
          status === "ANSWERING" ||
          status === "RINGING") && (
          <Flex
            justify="center"
            align="center"
            position="absolute"
            left="0"
            bottom={typeof status === "object" ? "3em" : "2em"}
          >
            <CallIcon
              tip="End"
              onClick={() => {
                if (answer) {
                  // 👇 destroy the peer on end
                  peers.answerer?.destroy();
                } else if (status === "RINGING") {
                  testObserver("CALL_CANCELED");

                  ws?.send(
                    constructMessage({
                      type: "CALL_CANCELED",
                    })
                  );

                  setStatus("CALL CANCELED");
                } else {
                  peers.caller?.destroy();
                }
              }}
              props={{
                filter: theme.blur.min,
              }}
            />
          </Flex>
        )}
      </Container>
    </List>
  );
};

export default VideoCall;
