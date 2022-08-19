// 👇 Styled Component
import styled from "styled-components";

export default styled.img.attrs(({ src, alt }) => ({
  src,
  alt: "image",
}))<
  Partial<{
    size: string;
    margin: string;
    ratio: "width" | "height";
    blur: boolean;
  }>
>`
  margin: ${({ margin }) => margin};
  width: ${({ size, ratio }) => (ratio === "height" ? "auto" : size || "50px")};
  height: ${({ size, ratio }) => (ratio === "width" ? "auto" : size || "50px")};
  aspect-ratio: ${({ ratio }) => ratio && 1};
  backdrop-filter: ${({ blur, theme }) => blur !== false && theme.blur.min};
  border-radius: 50%;
  object-fit: fill;
`;
