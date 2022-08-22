// 👇 React
import { useCallback, useState } from "react";
// 👇 Apollo & Graphql
import { ApolloError, useApolloClient } from "@apollo/client";
// 👇 Styles
import { Text, Error } from "../styles/Text";
import { Flex } from "../styles/Containers";
// 👇 Components
import { PlaceHolder, Spinner } from "../components/Loader";
// 👇 Custom hooks
import { useReference } from "./useReference";
// 👇 Constants, Helpers & Types
import { apolloErrorMessage, testObserver } from "../utils/helpers";
import { GqlQueries, GqlQuery, GqlQueryMore, Variables } from "../utils/types";

export const usePagination = <T,>(
  ref: (node?: Element | null) => void,
  inView: boolean
) => {
  const client = useApolloClient();
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const refetch = useReference(true);

  const paginate = useCallback(
    (
      queryArgs: {
        query: GqlQueries;
        loading: boolean;
        data: T[] | undefined;
        fetch: GqlQuery;
        fetchMore: GqlQueryMore;
      },
      variables: Variables = {},
      offsetUpdate: number = -1
    ) => {
      const { loading, query, data, fetch, fetchMore } = queryArgs;

      if (loading) {
        return;
      }

      // 👇 reset error
      setError("");

      if (refetch.value) {
        refetch.update(false);

        setFinished(false);

        // 👇 reset this query cache
        client.cache.modify({
          fields: {
            [query]: () => undefined,
          },
        });

        testObserver("FETCH");
        fetch({
          variables: {
            ...variables,
            offset: 0,
          },
        }).then(({ data: data_new, error }) => {
          // console.log("FETCH", { data_new, data, error });
          if (error) {
            setError(apolloErrorMessage(error, query).message);
          } else {
            // 👇 set finished if data array is empty
            setFinished(!data_new[query].length);
          }
        });
      } else if (!finished) {
        const offset = offsetUpdate === -1 ? data?.length : offsetUpdate;
        if (typeof offset !== "number") {
          return;
        }

        testObserver("FETCH_MORE");
        fetchMore({ variables: { offset } }).then(
          ({ data: data_new, data, errors }) => {
            // console.log("FETCH_MORE", { data_new, data, error });
            if (errors) {
              const error: Partial<ApolloError> = {
                graphQLErrors: errors,
              };
              setError(apolloErrorMessage(error, query).message);
            } else {
              const length = data_new[query].length;
              if (!length) {
                // 👇 check that last call returning no data is called twice for testing
                testObserver("FETCH_MORE_FINAL");
              }
              // 👇 set finished if data array is empty
              setFinished(!length);
            }
          }
        );
      }
    },

    [inView, refetch, finished]
  );

  // 👇 status display components for progress of pagination
  const Progress = useCallback(
    ({ placeholder }: { placeholder?: boolean }) => (
      <Flex ref={ref} direction="column" align="center" padding="1em 0">
        {error ? (
          <Error>{error}</Error>
        ) : finished ? (
          <Text>Finished.</Text>
        ) : placeholder ? (
          <PlaceHolder length={5} />
        ) : (
          <Spinner />
        )}
      </Flex>
    ),
    [ref, error, finished]
  );

  return {
    error,
    paginate,
    finished,
    reset: () => refetch.update(true),
    Progress,
  };
};
