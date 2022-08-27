// 👇 Styled Component
import styled from "styled-components";
// 👇 Styles
import { Flex } from "../styles/Containers";
import { InputCSS } from "../styles/Input";
// 👇 Icons
import { SearchIcon } from "./Icons";
// 👇 Custom hooks
import { useReference } from "../hooks/useReference";
// 👇 Constants, Helpers & Types
import { secsToMs } from "../utils/helpers";
import { useEffect } from "react";

const SearchIconEdit = styled(SearchIcon)`
  position: absolute;
  left: 1em;
  top: 50%;
  transform: translateY(-50%);
`;

const Input = styled.input.attrs({
  "aria-label": "Search",
  type: "Search",
})`
  ${InputCSS};
  padding-left: ${({ theme }) => `calc(2 * 0.8em + ${theme.sizing.icon})`};
`;

const SearchInput = ({
  width,
  placeholder,
  margin,
  maxWidth,
  valueChanged,
}: Partial<{
  width: string;
  placeholder: string;
  margin: string;
  maxWidth: string;
  valueChanged: (value: string) => void;
}>) => {
  const valueTimeOut = useReference(0);

  useEffect(() => {
    return () =>
      // 👇 clear the timeout on unmount
      window.clearTimeout(valueTimeOut.value);
  }, []);

  return (
    <Flex
      width={width}
      margin={margin}
      max={{
        width: maxWidth || "500px",
      }}
    >
      <SearchIconEdit />
      <Input
        // 👇 simulate debounce
        onChange={({ currentTarget: { value } }) => {
          // 👇 clear the timeout
          window.clearTimeout(valueTimeOut.value);
          // 👇 start timing for event "completion"
          valueTimeOut.update(
            window.setTimeout(() => valueChanged?.(value), secsToMs(0.5))
          );
        }}
        placeholder={placeholder}
      />
    </Flex>
  );
};
export default SearchInput;
