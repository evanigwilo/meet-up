// 👇 React
import { useState, useEffect, useMemo, useLayoutEffect } from "react";
// 👇 Apollo & Graphql
import { gql, useApolloClient } from "@apollo/client";
// 👇 Styled Component
import styled, { useTheme } from "styled-components";
// 👇 Faker
import { faker } from '@faker-js/faker';
// 👇 Intersection Observer
import { useInView } from "react-intersection-observer";
// 👇 Styles
import { Text } from "../styles/Text";
import { Flex, ToolTip } from "../styles/Containers";
import DashedBorder from "../styles/DashedBorder";
// 👇 Components
import { Spinner } from "../components/Loader";
import Attachment from "../components/Attachment";
import Post from "../components/Post";
import Trends from "../components/Trends";
// 👇 Custom hooks
import { USE_MUTATION, USE_QUERY } from "../hooks/useApollo";
import { usePagination } from "../hooks/usePagination";
// 👇 Context
import { useStore } from "../providers/context";
// 👇 Constants, Helpers & Types
import { PostType } from "../utils/types";
import { gqlPost } from "../utils/constants";
import { AuthType } from "../utils/types/enum";
import {
  avatarUrl,
  randomNumber,
  sleep,
  testObserver,
  uniqueId,
} from "../utils/helpers";

const Container = styled(Flex)`
  flex-direction: column;
  /* 
    Medium devices (tablets, 768px and up)
  */
  @media screen and (min-width: 768px) {
    width: 75%;
  }
`;

const More = styled(Text)`
  transform: scale(1, -2) rotateZ(90deg);
  transform-origin: bottom;
  padding-left: 0.25em;
  margin-right: 1em;
`;

const Home = () => {
  const theme = useTheme();
  const { user } = useStore();
  const client = useApolloClient();
  const { ref, inView } = useInView({
    initialInView: true,
  });
  const { paginate, finished, Progress } = usePagination(ref, inView);
  const [postCounter, setPostCounter] = useState(0);
  const [loading, setLoading] = useState(false);

  const GET_POSTS = USE_QUERY<PostType[]>(true, "getPosts");
  const CREATE_POST = USE_MUTATION<PostType>("createPost", (data) => {
    client.cache.modify({
      fields: {
        [GET_POSTS.query](existingPosts: PostType[] | null) {
          if (!existingPosts) {
            return existingPosts;
          }

          const newPost = client.cache.writeFragment({
            data,
            fragment: gql`
              fragment Post on Post {
                ${gqlPost}
              }
            `,
          });

          return [newPost, ...existingPosts];
        },
      },
    });
  });

  // 👇 load posts pagination
  useLayoutEffect(() => {
    if (finished || !inView) {
      return;
    }

    paginate(GET_POSTS);
  }, [inView, GET_POSTS.loading]);

  // 👇 load dummy new posts handler
  useEffect(() => {
    if (loading) {
      sleep(1).then(() => {
        // 👇 add dummy posts to cache
        client.cache.modify({
          fields: {
            [GET_POSTS.query](existingPosts: PostType[] | null) {
              if (!existingPosts) {
                return existingPosts;
              }
              const newPosts = [];
              for (let counter = 0; counter < postCounter; counter++) {
                // 👇 sample users for creating random dummy post
                const totalUsers = 10;
                const randomUsers = Array.from({ length: totalUsers }).map(() =>
                  faker.helpers.unique(faker.random.alphaNumeric, [5])
                );
                const createdDate = Date.now().toString();
                const count = existingPosts.length + postCounter - counter;

                // 👇 create dummy post
                const dummyPost: PostType = {
                  id: uniqueId() + ":POST",
                  body:
                    faker.random.words(
                      faker.datatype.number({
                        min: 3,
                        max: 10,
                      })
                    ) +
                    " - " +
                    count,
                  media: null,
                  createdDate,
                  createdBy: {
                    id: uniqueId() + ":USER",
                    username: randomUsers[randomNumber(totalUsers)],
                    name: faker.name.fullName(),
                    auth: AuthType.PASSWORD,
                    active: createdDate,
                    createdDate,
                    __typename: "User",
                  },
                  stats: {
                    // 👇 10**6 => 10^6
                    likes: randomNumber(10 ** (randomNumber(4) + 1)),
                    comments: randomNumber(10 ** (randomNumber(2) + 1)),
                    liked: 0,
                    __typename: "Stats",
                  },
                  parent: null,
                  __typename: "Post",
                };

                const postElement = client.cache.writeFragment({
                  data: dummyPost,
                  fragment: gql`
                  fragment Post on Post {
                    ${gqlPost}
                  }
                `,
                });

                newPosts.push(postElement);
              }

              return [...newPosts, ...existingPosts];
            },
          },
        });

        setLoading(false);
        setPostCounter(0);
      });
    } else {
      testObserver("SET_POST_COUNTER");
      // 👇 reset post counter after 3 secs
      sleep(3).then(() => {
        setPostCounter(randomNumber() + 1);
      });
    }
  }, [loading]);

  // 👇 posts memo to prevent unnecessary re-render
  const Posts = useMemo(
    () => GET_POSTS.data?.map((post) => <Post key={post.id} post={post} />),
    [GET_POSTS.data?.length]
  );

  return (
    <Flex overflow="hidden">
      <Container>
        {user && (
          <Attachment
            wsKey="post"
            padding="0 0.5em"
            category="POST"
            sendTip="Post"
            onUpdate={() => {
              CREATE_POST.reset();

              // 👇 scroll to top of page to ensure media is visible to user
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            sendClick={(input, id) => {
              // 👇 clear result and errors
              CREATE_POST.reset();

              CREATE_POST.mutate({
                variables: {
                  postInput: {
                    id,
                    body: input.value,
                  },
                },
              });

              // 👇 clear input
              input.setValue("");
            }}
            inputProps={{
              placeholder: "What’s happening?",
              profile: avatarUrl(user.id),
              loading: CREATE_POST.loading,
              error: CREATE_POST.error,
              handle: true,
              emojiProp: {
                iconInsideInput: false,
                position: "bottom",
              },
            }}
          />
        )}

        {!!postCounter && (
          <Flex
            direction="column"
            align="center"
            margin={theme.spacing.top("1em")}
          >
            <DashedBorder />

            <Flex margin="0.25em" align="center" justify="center">
              {loading ? (
                <Spinner />
              ) : (
                <ToolTip
                  data-testid="newPosts"
                  border={{
                    width: "0",
                    radius: "0",
                  }}
                  width="100%"
                  scale={1.05}
                  onClick={() => setLoading(true)}
                >
                  <More dim>《</More>
                  <Text dim>{`Show new posts (${postCounter})`}</Text>
                </ToolTip>
              )}
            </Flex>

            <DashedBorder />
          </Flex>
        )}

        {Posts}

        <Progress />
      </Container>

      <Trends />
    </Flex>
  );
};
export default Home;
