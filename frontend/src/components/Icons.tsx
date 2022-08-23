// 👇 Styled Component
import styled, { css, useTheme } from "styled-components";
// 👇 Icons
import { People } from "@styled-icons/bootstrap/People";
import { Image } from "@styled-icons/bootstrap/Image";
import { CameraVideo } from "@styled-icons/bootstrap/CameraVideo";
import { Chat } from "@styled-icons/bootstrap/Chat";
import { Bell } from "@styled-icons/bootstrap/Bell";
import { Person } from "@styled-icons/bootstrap/Person";
import { PencilSquare } from "@styled-icons/bootstrap/PencilSquare";
import { Messenger } from "@styled-icons/bootstrap/Messenger";
import { Grid3x3GapFill } from "@styled-icons/bootstrap/Grid3x3GapFill";
import { ThreeDotsVertical } from "@styled-icons/bootstrap/ThreeDotsVertical";
import { EmojiSmile } from "@styled-icons/bootstrap/EmojiSmile";
import { Trash3 } from "@styled-icons/bootstrap/Trash3";
import { Heart } from "@styled-icons/bootstrap/Heart";
import { HeartFill } from "@styled-icons/bootstrap/HeartFill";
import { ChatDots } from "@styled-icons/bootstrap/ChatDots";
import { Share } from "@styled-icons/bootstrap/Share";
import { ThreeDots } from "@styled-icons/bootstrap/ThreeDots";
import { Search } from "@styled-icons/bootstrap/Search";
import { Camera2 } from "@styled-icons/bootstrap/Camera2";
import { Check2Circle } from "@styled-icons/bootstrap/Check2Circle";
import { BoxArrowInRight } from "@styled-icons/bootstrap/BoxArrowInRight";
import { BoxArrowRight } from "@styled-icons/bootstrap/BoxArrowRight";
import { CameraVideoFill } from "@styled-icons/bootstrap/CameraVideoFill";
import { Headphones } from "@styled-icons/bootstrap/Headphones";
// 👇 Styles
import { IconCSS } from "../styles/Icon";
import { Text } from "../styles/Text";
import { ToolTip } from "../styles/Containers";
// 👇 Constants, Helpers & Types
import { Spacing } from "../utils/types";

export const HeartFillIcon = styled(HeartFill)<Spacing>`
  ${IconCSS};
  opacity: 0.9;
  fill: red;
`;

export const ImageIcon = styled(Image)<{ dimension?: string }>`
  ${IconCSS};
  ${({ dimension }) =>
    dimension &&
    css`
      --dimension: ${dimension};
    `};
`;
export const CameraVideoFillIcon = styled(CameraVideoFill)<{
  dimension?: string;
}>`
  ${IconCSS};
  ${({ dimension }) =>
    dimension &&
    css`
      --dimension: ${dimension};
    `};
`;
export const HeadphonesIcon = styled(Headphones)<{ dimension?: string }>`
  ${IconCSS};
  ${({ dimension }) =>
    dimension &&
    css`
      --dimension: ${dimension};
    `};
`;
export const PeopleIcon = styled(People)`
  ${IconCSS};
`;
export const CameraVideoIcon = styled(CameraVideo)`
  ${IconCSS};
`;
export const ChatIcon = styled(Chat)`
  ${IconCSS};
`;
export const BellIcon = styled(Bell)`
  ${IconCSS}
`;
export const MessengerIcon = styled(Messenger)`
  ${IconCSS};
`;
export const Grid3x3GapFillIcon = styled(Grid3x3GapFill)`
  ${IconCSS};
`;
export const PersonIcon = styled(Person)`
  ${IconCSS};
`;
export const PencilSquareIcon = styled(PencilSquare)`
  ${IconCSS};
`;
export const ThreeDotsVerticalIcon = styled(ThreeDotsVertical)`
  ${IconCSS};
`;
export const EmojiSmileIcon = styled(EmojiSmile)`
  ${IconCSS};
`;
export const Trash3Icon = styled(Trash3)`
  ${IconCSS};
`;
export const SearchIcon = styled(Search)`
  ${IconCSS};
`;
export const HeartIcon = styled(Heart)<Spacing>`
  ${IconCSS};
`;
export const CommentIcon = styled(ChatDots)<Spacing>`
  ${IconCSS};
`;
export const ShareIcon = styled(Share)<Spacing>`
  ${IconCSS};
`;
export const MoreIcon = styled(ThreeDots)<Spacing>`
  ${IconCSS};
`;
export const Camera2Icon = styled(Camera2)<Spacing>`
  ${IconCSS};
`;
export const Check2CircleIcon = styled(Check2Circle)<Spacing>`
  ${IconCSS};
`;

export const BoxArrowInRightIcon = styled(BoxArrowInRight)<Spacing>`
  ${IconCSS};
`;
export const BoxArrowRightIcon = styled(BoxArrowRight)<Spacing>`
  ${IconCSS};
`;

export const CallIcon = ({
  tip,
  onClick,
  props,
}: {
  tip: "Decline" | "Accept" | "Call" | "End";
  onClick?: () => void;
  props?: typeof ToolTip.defaultProps;
}) => {
  const theme = useTheme();

  return (
    <ToolTip
      data-testid={tip}
      scale={1.05}
      border
      tip={tip}
      margin="0 0.25em"
      width="1.5em"
      height="1.5em"
      tipPosition="top"
      onClick={() => onClick?.()}
      {...props}
    >
      <Text
        className="color-keep"
        bold
        font="xx-large"
        padding={theme.spacing.top("0.05em")}
        color={
          tip === "Accept" || tip === "Call" ? "rgb(0 255 0)" : "rgb(255 0 0)"
        }
      >
        ✆
      </Text>
    </ToolTip>
  );
};
