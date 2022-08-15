// 👇 Styled Component
import styled, { css } from "styled-components";
// 👇 Styles
import { HoverCSS } from "./Interactions";
// 👇 Constants, Helpers & Types
import { Ellipsis } from "../utils/types";

export const Text = styled.span<{
  hide?: boolean;
  dim?: boolean;
  paragraph?: boolean;
  margin?: string;
  padding?: string;
  font?: string;
  color?: string;
  bold?: boolean;
  ellipsis?: Ellipsis;
  transform?: "uppercase" | "lowercase" | "capitalize";
  align?: "center" | "right";
  preserve?: boolean;
  hover?: boolean;
  border?:
    | boolean
    | Partial<{
        width: string;
        radius: string;
      }>;
}>`
  color: ${({ dim, theme, color }) =>
    dim ? theme.color.textColor : color || "white"};
  text-align: ${({ align }) => align};
  white-space: ${({ preserve }) => (preserve ? "pre" : "pre-line")};
  margin: ${({ margin }) => margin};
  padding: ${({ padding }) => padding};
  display: ${({ paragraph }) => paragraph && "block"};
  font-size: ${({ font }) => font};
  font-weight: ${({ bold }) => bold && "bold"};
  /* vertical-align: middle; */
  text-transform: ${({ transform }) => transform};
  transition: inherit;

  ${({ border, theme }) =>
    border &&
    css`
      border: ${border === true ? "0.25em" : border.width} solid
        ${theme.color.transparentLight};
      border-radius: ${border === true ? "10px" : border.radius};
    `}

  ${({ ellipsis }) =>
    ellipsis &&
    (ellipsis > 1
      ? css`
          display: -webkit-box;
          -webkit-line-clamp: ${ellipsis};
          -webkit-box-orient: vertical;
          overflow: hidden;
          white-space: unset;
        `
      : css`
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        `)};

  ${({ hover }) =>
    hover &&
    css`
      ${HoverCSS};
      --hoverColor: none;
    `};

  /* mobile */
  @media (max-width: 575px) {
    display: ${({ hide }) => hide && "none"};
  }
`;

export const Error = styled(Text).attrs(({ className }) => ({
  className: "error",
}))`
  position: relative;
  display: flex;
  align-items: center;
  text-align: left;
  color: rgb(255 128 128);
  text-shadow: 0px 0px 1px black;
  &:before {
    content: "🚫"; /* ⚠️ ❗️ ❌ */
    margin-right: 0.25em;
    align-self: flex-start;
    /* vertical-align: middle; */
  }
`;
