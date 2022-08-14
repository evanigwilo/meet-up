// 👇 Styled Component
import { css } from "styled-components";
// 👇 Images
import background from "../images/Night-Jeep.jpg";

export const BackgroundCSS = css`
  background-image: url(${background});
  background-repeat: no-repeat;
  background-size: cover;
  background-attachment: var(--attachment);
  background-clip: padding-box; /* for border-radius to work on background image */
  scroll-behavior: smooth;
  &:after {
    content: "";
    position: var(--position);
    border-radius: inherit;
    top: 0;
    left: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    background-color: rgb(19 39 74 / 50%);
    backdrop-filter: ${({ theme }) => theme.blur.max};
  }
`;
