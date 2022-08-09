declare module "react-input-emoji" {
  type Props = {
    onChange;
    onEnter;
    onResize;
    onClick;
    onFocus;
    onKeyDown;
    theme;
    cleanOnEnter;
    placeholder;
    maxLength;
    keepOpened;
    inputClass;
    disableRecent;
    tabIndex;
    value;
    customEmojis;
    searchMention;
    // style
    borderRadius;
    borderColor;
    fontSize;
    fontFamily;
  };
  export default function InputEmoji(
    props: Partial<Props>,
    ref
  ): React.ReactElement;
}
