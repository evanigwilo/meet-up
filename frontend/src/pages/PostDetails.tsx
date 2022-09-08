// 👇 React
import { useLayoutEffect } from "react";
// 👇 Styled Component
import { useTheme } from "styled-components";
// 👇 React Router
import { useParams } from "react-router-dom";
// 👇 Styles
import { Text, Error } from "../styles/Text";
import { Flex } from "../styles/Containers";
import DashedBorder from "../styles/DashedBorder";
// 👇 Components
import { Spinner } from "../components/Loader";
import Post from "../components/Post";
// 👇 Custom hooks
import { USE_QUERY } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { PostType } from "../utils/types";
import { testObserver, trimTitle } from "../utils/helpers";
import { SEO } from "../utils/constants";

const PostDetails = () => {
  const theme = useTheme();
  const params = useParams();
  const id = params.postId || params.replyId;

  const GET_POST = USE_QUERY<PostType>(false, "getPost");

  useLayoutEffect(() => {
    testObserver("GET_POST");
    // 👇 fetch post on route parameter change
    GET_POST.fetch({
      variables: {
        id,
      },
    });
  }, [id]);

  // 👇 page title
  useLayoutEffect(() => {
    const postOrReply = GET_POST.data;
    if (postOrReply) {
      document.title = `${postOrReply.createdBy.name} (${
        postOrReply.createdBy.username
      }) on ${SEO.title}: "${trimTitle(postOrReply.body)}" / ${SEO.title}`;
    }
  }, [GET_POST.data]);

  return (
    <Flex direction="column" margin="1em 0">
      <Flex direction="column" align="flex-start">
        <DashedBorder />

        <Flex padding="0.5em 0" margin={theme.spacing.left("0.5em")}>
          {GET_POST.loading ? (
            <Spinner />
          ) : GET_POST.error ? (
            <Error>{GET_POST.error}</Error>
          ) : (
            <Text font="1.3em" transform="capitalize">
              ✍︎ {GET_POST.data?.parent ? "reply" : "post"}
            </Text>
          )}
        </Flex>

        <DashedBorder />
      </Flex>

      {GET_POST.data && <Post post={GET_POST.data} detail={GET_POST.data.id} />}
    </Flex>
  );
};
export default PostDetails;
