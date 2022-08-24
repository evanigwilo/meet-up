// 👇 React
import { useRef, useLayoutEffect, useCallback } from "react";
// 👇 Styled Component
import styled from "styled-components";
// 👇 Emoji Input Component
import InputEmoji from "react-input-emoji";
// 👇 Components
import LoadingImage from "./LoadingImage";
// 👇 Custom hooks
import { useResize } from "../hooks/useResize";
import { useSearch } from "../hooks/useSearch";
import { useReference } from "../hooks/useReference";
// 👇 Styles
import { IconCSS } from "../styles/Icon";
import { InputCSS } from "../styles/Input";
import { Flex } from "../styles/Containers";
// 👇 Constants, Helpers & Types
import { InputElement, InputType } from "../utils/types";
import { updateProperty, updateStyle } from "../utils/helpers";

const Container = styled(Flex)<{
  topBottom?: "top" | "bottom";
  innerIcon: "static" | "absolute";
  centerIcon?: boolean;
}>`
  --width: unset;
  --height: unset;
  opacity: 0;
  transition: opacity 0.25s;
  align-items: ${({ centerIcon }) => centerIcon && "center"};

  .react-emoji {
    width: ${({ theme }) => theme.sizing.icon};
    position: ${({ innerIcon }) => innerIcon};
    top: ${({ centerIcon }) => (centerIcon ? "50%" : "0")};
    transform: ${({ centerIcon, innerIcon }) =>
      `translateY(${centerIcon && innerIcon === "absolute" ? "-50%" : "0"})`};
    right: 1em;
    margin-right: 1em;
    /* mobile */
    @media (max-width: 576px) {
      display: none;
    }
  }

  .react-input-emoji--container {
    margin: 0;
    border: none;
  }

  .react-input-emoji--input {
    height: 0px;
  }

  .react-input-emoji--button svg {
    ${IconCSS};
    margin-right: 0.5em;
  }

  .react-input-emoji--button {
    display: flex;
    padding: 0;
  }

  .react-emoji-picker {
    width: calc(var(--width) - 2em);
  }

  .react-emoji-picker--wrapper {
    height: 350px;
    width: 100%;
    overflow: unset;
    left: ${({ innerIcon }) =>
      `calc(-1 * var(--width) + ${innerIcon === "absolute" ? "3em" : "0em"})`};
    top: ${({ topBottom }) =>
      topBottom === "bottom" && "calc(var(--height) + 0.5em)"};
    margin-bottom: 1em;
  }

  .emoji-mart {
    width: 100% !important;
  }

  .emoji-mart-scroll {
    padding: 0;
  }

  .emoji-mart-category-list {
    width: 100%;
    /* text-align: center; */
  }
  .emoji-mart-category-label {
    top: -1px;
  }
`;

const TextInput = styled.textarea.attrs(({ rows, cols, autoFocus }) => ({
  rows: 1,
  cols: 25,
  autoFocus: false,
}))<{ paddingRight?: string }>`
  ${InputCSS};
  height: min-content;
  margin: 0 1em;
  overflow: hidden;
  /* disable the resize handle */
  resize: none;
  line-height: 1.25em;
  color: transparent;
  caret-color: white;
  @media screen and (min-width: 576px) {
    padding-right: ${({ paddingRight }) => paddingRight};
  }
`;

// 👇 clone properties of textarea to show user handle highlight
const HandleViewer = styled.div.attrs(({ contentEditable }) => ({
  // contentEditable: true,
}))`
  ${InputCSS};
  height: min-content;
  position: absolute;
  z-index: -1;
  top: 0;
  pointer-events: none;
  overflow: hidden;
  background-color: transparent;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  line-height: 1.25em;
`;

const insertAtCursor = (input: InputElement, value: string) => {
  // 👇 IE not supported
  const startPos = input.selectionStart || 0;
  const endPos = input.selectionEnd || startPos;

  if (input.selectionStart || input.selectionStart === 0) {
    input.value =
      input.value.substring(0, startPos) +
      value +
      input.value.substring(endPos, input.value.length);
  } else {
    input.value += value;
  }
  input.selectionStart = input.selectionEnd = startPos + value.length;
  input.focus();
};

const Input = ({
  profile,
  placeholder,
  heightChange, // input height changed
  valueChange, // input value changed
  getInput, // input reference callback
  emojiProp,
  lines,
  alignCenter, // emoji and profile icon alignment
  handle, // handle viewer enabler
}: Partial<{
  profile: string;
  placeholder: string;
  heightChange: () => void;
  valueChange: (value: string) => void;
  getInput: (input: InputType) => void;
  emojiProp: Partial<{
    position: "top" | "bottom"; // position of the emoji viewer, top or bottom of input
    iconInsideInput: boolean;
  }>;
  lines: number;
  alignCenter: boolean;
  handle: boolean;
}>) => {
  const container = useRef<HTMLDivElement | null>(null);
  const handleViewer = useRef<HTMLDivElement | null>(null);
  const textInput = useRef<InputType | null>(null);
  const variables = useReference({
    cursorPos: 0,
    maxHeight: 0,
  });

  const findUser = useSearch({
    props: {
      left: "0",
      top: "0",
      width: "100%",
    },
    onClick: (user) => {
      const input = textInput.current;
      if (!input) {
        return;
      }
      const { value, selectionStart } = input;
      let start = Math.min(selectionStart, value.length - 1);
      let end = start;
      while (value[end] && value[end] !== " " && value[end] !== "\n") {
        end++;
      }
      while (value[start] && value[start] !== "@") {
        start--;
      }

      const word = "@" + user.username;

      // 👇 update input value with selected username
      input.value = value.substring(0, start) + word + value.substring(end);

      input.selectionStart = input.selectionEnd = start + word.length;

      input.focus();

      updateInputHeight();

      valueChange?.(input.value);

      hideHandleSearch();
    },
  });

  const isHandle = useCallback(
    (word: string) =>
      handle && /^[@].{1}/i.test(word) && word.match(/[@]/g)?.length === 1,
    [handle]
  );

  const updateMaxHeight = useCallback(() => {
    const input = textInput.current;
    if (!input) {
      return;
    }

    variables.value.maxHeight = input.clientHeight * (lines || 10);
    updateStyle(input, {
      maxHeight: `calc(${variables.value.maxHeight}px + 2em)`,
    });
  }, []);

  const updatePickerPosition = useCallback(() => {
    const input = textInput.current;
    if (!input) {
      return;
    }

    // 👇 Update react emoji picker location based on input size
    const width = input.offsetWidth + "px";
    const height = input.offsetHeight + "px";
    updateProperty(input.parentElement, {
      "--width": width,
      "--height": height,
    });
  }, []);

  const updateHandleViewer = useCallback(() => {
    const input = textInput.current;
    const viewer = handleViewer.current;
    if (!input || !viewer) {
      return;
    }

    // 👇 clear all contents
    while (viewer.firstChild) {
      viewer.removeChild(viewer.firstChild);
    }

    let html = "";
    // 👇 copy text contents from input to handle viewer
    input.value.split("\n").forEach((value) => {
      if (value) {
        html += "<p>";

        value.split(" ").forEach((word, index, { length }) => {
          // 👇 starts with @ and has a min length of 1 after @ e.g. @a, @abc,...
          if (isHandle(word)) {
            // 👇 class handle for clolr formatting
            html += '<span class="handle">' + word + "</span>";
          } else {
            html += word;
          }
          if (index < length - 1) {
            html += " ";
          }
        });

        html += "</p>";
      } else {
        html += "<br>";
      }
    });
    viewer.innerHTML = html;

    // 👇 copy styles from input to handle viewer
    updateStyle(viewer, {
      paddingRight: window
        .getComputedStyle(input)
        .getPropertyValue("padding-right"),
      height: input.style.height,
      maxHeight: input.style.maxHeight,
      width: input.offsetWidth + "px",
      left: input.offsetLeft + "px",
      overflow:
        input.style.overflow === "unset" ? "auto" : input.style.overflow,
    });
  }, []);

  const updateInputHeight = useCallback(
    (resize = false) => {
      const input = textInput.current;
      if (!input) {
        heightChange?.();
        return;
      }

      // 👇 Update input height
      const prev = input.style.height;
      updateStyle(input, { height: "min-content" });

      // 👇 update max height
      if (resize) {
        updateMaxHeight();
      }

      // 👇 Update profile and emoji icon placement
      const { previousSibling, nextSibling } = input;
      const emojiInput = nextSibling as HTMLDivElement;
      updateStyle(emojiInput, {
        height: `calc(${input.clientHeight}px + 2em)`,
      });

      if (profile) {
        const profileImage = previousSibling as HTMLDivElement;
        updateStyle(profileImage, {
          marginTop: alignCenter
            ? "0"
            : `calc((${input.clientHeight}px - 40px) / 2 + 1em)`,
        });
      }

      const curr = `calc(${input.scrollHeight}px + 2em)`;
      updateStyle(input, {
        height: curr,
      });

      // 👇 Update emoji icon height again to match align center
      if (alignCenter) {
        updateStyle(emojiInput, {
          height: `calc(${input.clientHeight}px + 2em)`,
        });
      }
      // 👇 Update style if input is relative to attachment component
      updateAttachmentStyles("height", emojiInput.style.height);

      // 👇 keep cursor position, dont update if resizing window
      if (!resize) {
        variables.value.cursorPos = input.selectionStart;
      }

      const overflow = input.scrollHeight > variables.value.maxHeight;
      updateStyle(emojiInput, {
        right: overflow ? "1em" : "1.5em",
      });
      updateStyle(input, {
        overflow: overflow ? "hidden" : "unset",
      });

      updatePickerPosition();

      updateHandleViewer();

      if (prev !== curr) {
        heightChange?.();
      }
    },
    [heightChange]
  );

  const resetCursor = useCallback(() => {
    const input = textInput.current;
    if (!input) {
      return;
    }
    input.selectionStart = input.selectionEnd = variables.value.cursorPos;
    /* 
      Medium devices (tablets, 768px and up)
    */
    const matchQuery = window.matchMedia("screen and (min-width: 768px)");
    if (matchQuery.matches) {
      // 👇 focus on input only on larger screen to prevent keyboard toggling automatically on mobile devices
      input.focus();
    }
  }, []);

  const updateAttachmentStyles = useCallback(
    (style: keyof CSSStyleDeclaration, value: string) => {
      const emojiContainer = textInput.current?.parentElement;
      // 👇 send icon and attach media icon
      updateStyle(emojiContainer?.previousSibling, {
        [style]: value,
      });
      updateStyle(emojiContainer?.nextSibling, {
        [style]: value,
      });
    },
    []
  );

  const hideHandleSearch = useCallback(() => {
    const viewer = handleViewer.current;
    if (!viewer) {
      return;
    }

    const handleSearch = viewer.nextSibling as HTMLDivElement;
    updateStyle(handleSearch, {
      pointerEvents: "none",
      opacity: "0",
    });
  }, []);

  const updateHandleViewerScroll = useCallback(() => {
    const input = textInput.current;
    const viewer = handleViewer.current;
    if (!input || !viewer) {
      return;
    }

    viewer.scrollTop = input.scrollTop;
  }, []);

  const getWord = useCallback(() => {
    const input = textInput.current;
    const viewer = handleViewer.current;
    const parent = container.current;
    if (!parent || !input || !viewer) {
      return;
    }

    const { value, selectionStart, offsetLeft } = input;

    const pos = selectionStart || 0;
    // 👇 keep cursor position incase of resize
    variables.value.cursorPos = pos;

    let next = pos;
    let prev = pos;
    while (value[next] && value[next] !== "\n" && value[next] !== " ") {
      next++;
    }
    while (
      value[prev - 1] &&
      value[prev - 1] !== "\n" &&
      value[prev - 1] !== " "
    ) {
      prev--;
    }
    const handleSearch = viewer.nextSibling as HTMLDivElement;
    const word = value.substring(prev, next);

    // 👇 hide search if word is not a handle
    if (!isHandle(word)) {
      updateStyle(handleSearch, {
        pointerEvents: "none",
        opacity: "0",
      });
      return;
    }
    let lineCount = 0;
    let offset = 0;
    for (let i = 0; i < prev; i++) {
      if (value[i] === "\n") {
        lineCount++;
        offset = i + 1;
      }
    }
    let spanCount = 0;
    value
      .substring(offset, prev)
      .split(" ")
      .forEach((word) => {
        if (isHandle(word)) {
          spanCount++;
        }
      });

    const child = viewer.children[lineCount].children[
      spanCount
    ] as HTMLSpanElement;

    const left = offsetLeft + child.offsetLeft;
    const gap = parent.offsetWidth - handleSearch.offsetWidth;

    // 👇 update handleSearch location to match word location
    updateStyle(handleSearch, {
      left: Math.min(left, gap) + "px",
      top: `calc(1em + ${child.offsetTop}px + ${child.offsetHeight}px - ${viewer.scrollTop}px)`,
      opacity: "1",
      pointerEvents: "unset",
    });

    // 👇 update word search
    findUser.search.update(word.slice(1));
  }, []);

  useLayoutEffect(() => {
    const input = textInput.current;
    const viewer = handleViewer.current;
    const parent = container.current;
    if (!parent || !input || !viewer) {
      return;
    }

    // 👇 initialize method for updating input value from outside this component
    input.setValue = (value: string) => {
      input.value = value;
      updateInputHeight();
    };
    // 👇 callback for receiving the input
    getInput?.(input);

    // 👇 Update profile and emoji icon placement
    const { previousSibling, nextSibling } = input;
    const transition = "all 0.25s";
    const transitionend = () => updateInputHeight();

    const emojiInput = nextSibling as HTMLDivElement;
    const profileImage = previousSibling as HTMLDivElement | null;

    updateStyle(emojiInput, { transition });
    emojiInput.addEventListener("transitionend", transitionend);

    if (profile) {
      updateStyle(profileImage, { transition });
      profileImage?.addEventListener("transitionend", transitionend);
    }

    // 👇 display input when this component mounts
    const opacity = "1";
    updateStyle(parent, { opacity });
    updateAttachmentStyles("opacity", opacity);

    // 👇 update input maximum height
    updateMaxHeight();
    const handleSearch = viewer.nextSibling as HTMLDivElement;
    updateStyle(handleSearch, {
      pointerEvents: "none",
      transition: "opacity 0.5s",
    });

    // 👇 remove events on unmount
    return () => {
      emojiInput.removeEventListener("transitionend", transitionend);
      profileImage?.removeEventListener("transitionend", transitionend);
    };
  }, []);

  useResize((ev) => {
    updateInputHeight(Boolean(ev));

    resetCursor();

    getWord();
  });

  return (
    <Container
      ref={container}
      index={1}
      topBottom={emojiProp?.position}
      centerIcon={alignCenter}
      innerIcon={emojiProp?.iconInsideInput ? "absolute" : "static"}
    >
      {profile && <LoadingImage src={profile} size="40px" />}
      <TextInput
        ref={textInput}
        onKeyUp={() => getWord()}
        onClick={() => getWord()}
        onScroll={() => {
          updateHandleViewerScroll();
          hideHandleSearch();
        }}
        placeholder={placeholder}
        paddingRight={emojiProp?.iconInsideInput ? "2em" : "1em"}
        onInput={({ currentTarget }) => {
          updateInputHeight();

          valueChange?.(currentTarget.value);
        }}
      />
      <InputEmoji
        onChange={(value: string) => {
          const input = textInput.current;

          if (!input || !value) {
            return;
          }

          insertAtCursor(input, value);

          updateInputHeight();

          valueChange?.(value);

          const emojis = input?.nextSibling?.firstChild?.firstChild?.lastChild;

          // 👇 clear emojis after input is updated with the emojis
          while (emojis && emojis.firstChild) {
            emojis.removeChild(emojis.firstChild);
          }
        }}
        cleanOnEnter
        keepOpened
        fontSize="unset"
        fontFamily="unset"
      />
      <div>
        <HandleViewer ref={handleViewer} />
        <Flex
          position="absolute"
          max={{
            width: "50%",
          }}
          left="0"
          opacity={0}
          onBlur={() => hideHandleSearch()}
        >
          {findUser.component}
        </Flex>
      </div>
    </Container>
  );
};

export default Input;
