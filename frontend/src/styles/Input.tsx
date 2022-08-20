// 👇 Styled Component
import { css } from "styled-components";

export const InputCSS = css`
  padding: 0 1em;
  border-width: 1em 0;
  border-style: solid;
  border-color: transparent;
  border-radius: 1.5em;
  color: white;
  background: ${({ theme }) => theme.color.transparentLight};
  outline: none;
  width: 100%;

  ${({ theme }) => css`
    ::placeholder,
    ::-webkit-input-placeholder {
      color: rgb(255 255 255 / ${theme.opacity.dim});
    }
    :-ms-input-placeholder {
      color: rgb(255 255 255 / ${theme.opacity.dim});
    }
  `};
`;
