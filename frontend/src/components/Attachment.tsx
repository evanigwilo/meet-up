// 👇 React
import {
  useState,
  useRef,
  ComponentProps,
  useLayoutEffect,
  useCallback,
} from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Styles
import { Flex, Media, ToolTip } from "../styles/Containers";
import { Error, Text } from "../styles/Text";
// 👇 Components
import Input from "./Input";
import MediaType from "./MediaType";
import { ImageIcon } from "./Icons";
// 👇 Services
import axios from "../services/axios";
import { AxiosError } from "axios";
// 👇 Context
import { useWs } from "../providers/ws";
// 👇 Custom hooks
import { useWsMessage } from "../hooks/useWsMessage";
import { useReference } from "../hooks/useReference";
// 👇 Constants, Helpers & Types
import { constructMessage, isMimeType, updateStyle } from "../utils/helpers";
import { serverName } from "../utils/constants";
import { InputType, KeyValue } from "../utils/types";

const Container = styled(Flex)`
  opacity: 0;
  transition: opacity 0.25s;
`;

const Send = styled(Text)`
  padding: 0;
  transform: scale(1.2, 2);
`;

// 👇 used for type reference
const tipPos = ToolTip.defaultProps?.tipPosition;

const Attachment = ({
  wsKey, // socket key to uniquely identify the attachment component the process the message
  padding,
  inputProps,
  onUpdate,
  sendClick,
  sendTip: postTip, // tip for sending button
  tipPosition,
  category, // for routing and ws messaging
}: {
  wsKey: string;
  padding?: string;
  inputProps: Omit<ComponentProps<typeof Input>, "valueChanged"> &
    Partial<{
      error?: string; // error message
      loading?: boolean; // input loading
    }>;
  onUpdate?: () => void;
  sendClick?: (input: InputType, id?: string) => void;
  tipPosition?: typeof tipPos;
  sendTip: "Send" | "Post" | "Reply";
  category: "POST" | "REPLY" | "MESSAGE";
}) => {
  const theme = useTheme();
  const ws = useWs();
  const media = useRef<HTMLDivElement | null>(null);
  const upload = useRef<HTMLInputElement | null>(null);
  const submit = useRef<HTMLInputElement | null>(null);
  // 👇 & unique id for uploading files
  const input = useRef<(InputType & { uniqueId?: string }) | null>(null);
  // 👇 file with object url property
  const [selectedFile, setSelectedFile] = useState<
    (File & { url?: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const status = useReference<"FILE" | "LOADING" | "ERROR" | "NONE">("NONE");
  // 👇 abort controller for canceling uploads
  const abortController = useReference(new AbortController());

  const AttachIcon = useCallback(
    () => (
      <form
        method="post"
        encType="multipart/form-data"
        onSubmit={(event) => {
          // 👇 prevent the form from submitting
          event.preventDefault();

          setStatus("LOADING", true);

          const inputElement = input.current;
          const mediaElement = media.current;
          const uniqueId = inputElement?.uniqueId;

          const percent = mediaElement?.querySelector(
            ".percent"
          ) as HTMLSpanElement;

          // 👇 reset percent
          percent.textContent = "0 %";

          const spinner = mediaElement?.querySelector(
            ".spinner"
          ) as HTMLDivElement;
          // 👇 show spinner with uploading style
          spinner.classList.add("progress", "upload");
          spinner.classList.replace("hide", "show");

          // 👇 reset previous errors
          setStatus("ERROR", "");

          const path = isMimeType("image", selectedFile?.type)
            ? "image"
            : "media";

          const url = `/${path}/${category.toLowerCase()}/${uniqueId}`;

          const formData = new FormData();
          formData.append(path, selectedFile!);

          axios
            .post(url, formData, {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              onUploadProgress: ({ loaded, total }: KeyValue<number>) => {
                // 👇 format upload percent
                percent.textContent = Math.round((100 * loaded) / total) + " %";
              },
              signal: abortController.value.signal,
            })
            .then(({ data }) => {
              closeMedia();

              inputElement && sendClick?.(inputElement, uniqueId);
            })
            .catch(({ response }: AxiosError) => {
              // 👇 not a canceled upload
              if (!response) {
                return;
              }
              const {
                data: { code, message },
                statusText,
              } = response;

              setStatus("ERROR", message || statusText);
            })
            .finally(() => {
              // 👇 hide spinner and reset percent
              spinner.classList.replace("show", "hide");
              spinner.classList.remove("progress", "upload");
              percent.textContent = "0 %";
              setStatus("LOADING", false);
            });
        }}
      >
        <input
          ref={upload}
          type="file"
          hidden
          accept="audio/*,video/*,image/*"
          // multiple
          onChange={({ target }) => {
            setStatus("ERROR", "");

            const file = target.files?.item(0) as typeof selectedFile;
            if (file) {
              // 👇 URL represents the specified File object
              file.url = URL.createObjectURL(file);
              setStatus("FILE", file);
            }
          }}
        />

        {/* 👇 the submit input for the form */}
        <input type="submit" ref={submit} hidden />

        <ToolTip
          data-testid={`attachment-${wsKey}-media-change`}
          hover={false}
          tipPosition={tipPosition || "top"}
          tip="Media"
          onClick={() => upload.current?.click()}
        >
          <ImageIcon />
        </ToolTip>
      </form>
    ),
    [selectedFile]
  );

  const AttachMedia = useCallback(
    () =>
      selectedFile && (
        <Media
          data-testid={`attachment-${wsKey}-media-file`}
          ref={media}
          width="calc(100% - 6em)"
          height={wsKey === "CHAT" ? "30%" : undefined}
        >
          <MediaType
            src={selectedFile.url!}
            mimeType={selectedFile.type}
            afterLoad={() => {
              const remove =
                media.current?.querySelector<HTMLDivElement>(".remove");
              // 👇 show remove icon
              updateStyle(remove, {
                opacity: "1",
                pointerEvents: "unset",
              });

              setStatus("LOADING", false);
            }}
          />

          <ToolTip
            className="remove"
            opacity={0}
            disabled
            tip="Remove"
            padding="0"
            border
            position="absolute"
            right="0"
            top="0"
            width="25px"
            height="25px"
            align="center"
            justify="center"
            onClick={() => {
              const mediaElement = media.current;
              mediaElement?.addEventListener("transitionend", closeMedia);
              updateStyle(mediaElement, {
                opacity: "0",
              });
            }}
          >
            <Text dim font="1.25em">
              ✕
            </Text>
          </ToolTip>
        </Media>
      ),
    [selectedFile]
  );

  // 👇 media url revoke
  const revokeUrl = useCallback(() => {
    const url = selectedFile?.url;
    url && URL.revokeObjectURL(url);
  }, [selectedFile]);

  const setStatus = useCallback((key: typeof status.value, value: unknown) => {
    status.update(key);

    switch (key) {
      case "FILE":
        setSelectedFile(value as typeof selectedFile);
        break;

      case "LOADING":
        setLoading(value as typeof loading);
        break;

      case "ERROR":
        setError(value as typeof error);
        break;

      default:
        break;
    }
  }, []);

  const closeMedia = useCallback(() => {
    const spinner = media.current?.querySelector<HTMLDivElement>(".spinner");
    if (spinner?.classList.contains("show")) {
      abortController.value.abort();
      abortController.update(new AbortController());
    }
    revokeUrl();
    setStatus("FILE", null);
  }, [selectedFile]);

  useWsMessage(({ type, content }) => {
    if (typeof content !== "object") {
      return;
    }

    const { id, wsKey: key } = content as KeyValue;

    // 👇 does the key match the unique key for this component
    if (key !== wsKey) {
      return;
    }

    const inputElement = input.current;
    const submitElement = submit.current;
    if (!inputElement || !submitElement) {
      return;
    }

    // 👇 update the unique id
    inputElement.uniqueId = id;

    if (type === "MESSAGE") {
      // 👇 MESSAGE
      sendClick?.(inputElement, id);
    } else if (type === `${category}_MEDIA` || type === `${category}_IMAGE`) {
      // 👇 input with image or media
      submitElement.click();
    }
  });

  useLayoutEffect(() => {
    switch (status.value) {
      case "FILE":
        onUpdate?.();
        if (selectedFile) {
          setStatus("LOADING", true);
        } else {
          setStatus("ERROR", "");
        }
        break;

      case "LOADING":
      case "ERROR":
        onUpdate?.();
        break;

      default:
        break;
    }

    /*
    return () => {
      switch (status.value) {
        case "FILE":
          revokeUrl();
          break;

        default:
          break;
      }
    };
    */
  }, [selectedFile, loading, error]);

  // 👇 revoke object ur on unmount
  useLayoutEffect(() => {
    return () => revokeUrl();
  }, []);

  return (
    <>
      <AttachMedia />

      {!loading && (error || inputProps.error) && (
        <Error margin="auto">{error || inputProps.error}</Error>
      )}

      <Flex
        data-testid={`attachment-${wsKey}`}
        index={category === "POST" ? 3 : 1}
        align="center"
        justify="center"
        padding={padding}
        margin={theme.spacing.top("0.5em")}
        disabled={loading || inputProps.loading}
        opacity={loading || inputProps.loading ? "dim" : 1}
      >
        {!inputProps.profile && (
          <Container width="unset" align="center">
            <AttachIcon />
          </Container>
        )}
        <Input
          {...inputProps}
          alignCenter={true}
          getInput={(element) => {
            // 👇 get the input reference on initial load
            input.current = element;
          }}
        />

        <Container width="unset" align="center">
          {inputProps.profile && <AttachIcon />}
          <ToolTip
            hover={false}
            tipPosition={tipPosition || "top"}
            tip={postTip}
            margin={inputProps.profile ? theme.spacing.left("1em") : "0"}
            onClick={() => {
              // 👇 use unique id if sending with attachment or just text messages
              if (selectedFile || category === "MESSAGE") {
                ws?.send(
                  constructMessage({
                    type: selectedFile
                      ? `${category}_${
                          isMimeType("image", selectedFile.type)
                            ? "IMAGE"
                            : "MEDIA"
                        }`
                      : "MESSAGE",
                    to: serverName,
                    content: { wsKey },
                  })
                );
              } else {
                // 👇 send without unique id i.e. post or reply without attachment
                const inputElement = input.current;
                inputElement && sendClick?.(inputElement);
              }
            }}
          >
            <Send dim>➢</Send>
          </ToolTip>
        </Container>
      </Flex>
    </>
  );
};

export default Attachment;
