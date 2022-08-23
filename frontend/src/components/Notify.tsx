// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 Styles
import { Flex, Row } from "../styles/Containers";
import { Anchor } from "../styles/Anchor";
import { Text } from "../styles/Text";
// 👇 Icons
import { CameraVideoFillIcon, HeadphonesIcon, ImageIcon } from "./Icons";
// 👇 Components
import LoadingImage from "./LoadingImage";
import { Spinner } from "./Loader";
// 👇 Constants, Helpers & Types
import { NotifyFormat, RowType } from "../utils/types";
import { messageFormat } from "../utils/helpers";

const Notify = ({
  testId, // identify component in testing
  message, // message properties
  icon, // icon properties
  row, // row properties
  element, // jsx element to append right of container
  profile, // user profile image
}: {
  testId?: string;
  message: Partial<{
    text: string;
    subText: string;
    call: boolean;
    media: boolean;
    loading: "text" | "subText" | false;
    bold: boolean;
    padding: string;
    format: NotifyFormat;
  }>;
  icon?: {
    text: string;
    font?: string;
  };
  row?: RowType &
    Partial<{
      click: () => void;
      padding: string;
      margin: string;
      link: string;
    }>;
  profile?: Partial<{
    size: string;
    src: string;
  }>;
  element?: JSX.Element;
}) => {
  const theme = useTheme();

  const format = message?.format && messageFormat(message.format);

  const iconFont = format?.icon || icon;

  const rowElement = (
    <>
      <Flex width="unset" overflow="hidden" align="center" height="100%">
        <Flex width="unset" align="flex-end">
          {profile?.src && (
            <LoadingImage
              src={profile.src}
              size={profile?.size || "40px"}
              prop={{
                margin: theme.spacing.left("0.125em"),
              }}
            />
          )}

          {iconFont && (
            <Text
              dim
              padding={theme.spacing.left("0.25em")}
              font={iconFont.font}
            >
              {iconFont.text}
            </Text>
          )}
        </Flex>
        <Flex
          padding={message.padding || theme.spacing.left("0.5em")}
          direction="column"
          overflow="hidden"
          justify="space-evenly"
          height="100%"
        >
          {message.loading === "text" ? (
            <Spinner />
          ) : (
            <Text
              {...(message?.bold && {
                bold: true,
                font: "large",
              })}
              margin={theme.spacing.bottom("0.25em")}
              ellipsis={1}
            >
              {format?.message.text || message?.text}
            </Text>
          )}
          {message.loading === "subText" ? (
            <Spinner />
          ) : (
            <Flex data-testid={`body-${testId}`} align="center">
              {message?.call && (
                <Text bold font="large" color="red">
                  ✆
                </Text>
              )}
              {message?.media &&
                (message?.subText === "Video" ? (
                  <CameraVideoFillIcon dimension="10px" />
                ) : message?.subText === "Audio" ? (
                  <HeadphonesIcon dimension="10px" />
                ) : (
                  <ImageIcon dimension="10px" />
                ))}
              <Text dim font="smaller" ellipsis={1}>
                {(message?.call || message?.media) && <>&nbsp;</>}
                {message?.subText}
              </Text>
            </Flex>
          )}
        </Flex>
      </Flex>
      {element}
    </>
  );

  return (
    <Row
      data-testid={testId}
      padding={row?.padding || "1em"}
      align="center"
      justify="space-between"
      highlight={row?.highlight}
      hover={row?.hover}
      backgroundLoading={row?.backgroundLoading}
      margin={row?.margin || "0.25em 0"}
      onClick={() => row?.click?.()}
    >
      {row?.link ? (
        // 👇 row should act as a link
        <Anchor to={row.link} width="100%">
          {rowElement}
        </Anchor>
      ) : (
        rowElement
      )}
    </Row>
  );
};
export default Notify;
