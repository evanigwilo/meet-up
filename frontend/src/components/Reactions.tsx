/*
  https://www.behance.net/gallery/34559659/Open-Source-Facebook-New-Reactions-Download?tracking_source=search_projects%7Cfacebook%20reactionshttps://www.behance.net/gallery/34559659/Open-Source-Facebook-New-Reactions-Download?tracking_source=search_projects%7Cfacebook%20reactions
*/

// 👇 React
import { useCallback, useEffect, useRef, useState } from "react";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Styles
import { Flex, ToolTip } from "../styles/Containers";
import Image from "../styles/Image";
// 👇 Images
import like from "../images/reactions/1-like.gif";
import love from "../images/reactions/2-love.gif";
import funny from "../images/reactions/3-funny.gif";
import wow from "../images/reactions/4-wow.gif";
import sad from "../images/reactions/5-sad.gif";
import angry from "../images/reactions/6-angry.gif";
// 👇 Custom hooks
import { useReference } from "../hooks/useReference";
import { USE_MUTATION } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { testObserver, updateStyle } from "../utils/helpers";
import { ReactionKeys, ReactionType } from "../utils/types";

const Container = styled(Flex)`
  transition: opacity 0.5s 0.25s;
`;

const Reactions = ({
  messageId,
  initial, // initial reaction value
  onSelect, // reaction selected callback
}: {
  messageId: string;
  initial: ReactionKeys | -1;
  onSelect: (reaction: ReactionKeys | -1) => void;
}) => {
  const theme = useTheme();
  const [selectedReaction, setSelectedReaction] = useState(initial);
  const container = useRef<HTMLDivElement | null>(null);
  const loaded = useReference(false);
  const size = "50px";

  const ADD_REACTION = USE_MUTATION<ReactionType>("addReactionMessage");
  const REMOVE_REACTION = USE_MUTATION<boolean>("removeReactionMessage");

  const modifyReaction = useCallback(
    async (ev: TransitionEvent) => {
      const element = container.current;
      if (
        element &&
        ev.target === element &&
        ev.propertyName === "opacity" &&
        element.style.opacity === "0"
      ) {
        const reaction = selectedReaction;

        onSelect(reaction);

        const option = {
          variables: {
            id: messageId,
            reaction,
          },
        };

        // 👇 remove or add reaction
        if (selectedReaction === -1) {
          delete (option.variables as Partial<typeof option.variables>)
            .reaction;
          testObserver("REMOVE_REACTION");
          REMOVE_REACTION.mutate(option);
        } else {
          testObserver("ADD_REACTION");
          ADD_REACTION.mutate(option);
        }

        element.removeEventListener("transitionend", modifyReaction);
      }
    },
    [selectedReaction]
  );

  const RenderReaction = useCallback(
    ({
      src,
      tip,
      reaction,
    }: {
      src: string;
      tip: string;
      reaction: ReactionKeys;
    }) => (
      <ToolTip
        data-testid={`reaction-${reaction}`}
        hover={selectedReaction === reaction}
        tip={tip}
        tipPosition="top"
        width={size}
        height={size}
        align="center"
        justify="center"
        scale={1.1}
        tipOffset="0.5em"
        padding="0"
        border={selectedReaction === reaction}
        onClick={() => {
          // 👇 simulate component loaded when reaction is clicked at first
          loaded.update(true);
          setSelectedReaction(selectedReaction === reaction ? -1 : reaction);
        }}
      >
        <Image size={size} src={src} />
      </ToolTip>
    ),
    [selectedReaction]
  );

  useEffect(() => {
    const element = container.current;

    if (!element) {
      return;
    }

    if (loaded.value) {
      element.addEventListener("transitionend", modifyReaction);
    }

    updateStyle(element, {
      opacity: loaded.value ? "0" : "1",
    });
  }, [selectedReaction]);

  return (
    <Container
      ref={container}
      align="center"
      wrap="wrap"
      opacity={0}
      margin={theme.spacing.top("1.5em")}
      justify="space-evenly"
    >
      <RenderReaction src={like} tip="Like" reaction="like" />
      <RenderReaction src={love} tip="Love" reaction="love" />
      <RenderReaction src={funny} tip="Haha" reaction="funny" />
      <RenderReaction src={wow} tip="Wow" reaction="wow" />
      <RenderReaction src={sad} tip="Sad" reaction="sad" />
      <RenderReaction src={angry} tip="Angry" reaction="angry" />
    </Container>
  );
};
export default Reactions;
