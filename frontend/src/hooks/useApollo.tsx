// 👇 React
import { useEffect } from "react";
// 👇 Apollo & Graphql
import {
  OperationVariables,
  useLazyQuery,
  useMutation,
  useSubscription,
} from "@apollo/client";
// 👇 Constants, Helpers & Types
import { gqlMutations, gqlSubscriptions } from "../utils/constants";
import { GqlMutations, GqlQueries, KeyValue } from "../utils/types";
import { apolloErrorMessage, gqlQuery } from "../utils/helpers";

// 👇 use query helper
export const USE_QUERY = <T,>(
  // 👇 use in-memory cache or no cache
  cache: boolean,
  query: GqlQueries,
  // 👇 optional query variables
  variables?: OperationVariables
) => {
  const [fetch, { data, error, loading, fetchMore, refetch, client }] =
    useLazyQuery<KeyValue<T>>(
      gqlQuery(query),

      {
        ...(cache
          ? {
              // 👇 Used for first execution
              fetchPolicy: "network-only",
              // 👇 Used for subsequent executions
              nextFetchPolicy: "cache-first",
            }
          : {
              // 👇 no in-memory cache
              fetchPolicy: "no-cache",
            }),
        errorPolicy: "all",
        refetchWritePolicy: "overwrite",
        notifyOnNetworkStatusChange: true,
        variables,
        onCompleted: (data) => {
          // console.log("onCompleted", { [query]: data[query] });
        },
        onError(err) {
          // console.log("onError", { err });
        },
      }
    );

  return {
    // 👇 the query
    query,
    // 👇 query error
    error: error ? apolloErrorMessage(error, query).message : error,
    // 👇 query fetch function
    fetch: (options?: Parameters<typeof fetch>[0]) =>
      new Promise<Awaited<ReturnType<typeof fetch>>>((resolve) => {
        fetch(options)
          .then((value) => resolve(value))
          .catch((error) => {});
      }),
    // 👇 query fetch more function
    fetchMore,
    // 👇 query refetch function
    refetch,
    // 👇 is query function processing
    loading,
    // 👇 query variables
    variables,
    // 👇 query result
    data: data?.[query],
    // 👇 apollo cache reference
    cache: client.cache,
  };
};

// 👇 use mutation helper
export const USE_MUTATION = <V,>(
  query: GqlMutations,
  // 👇 successful response callback
  onUpdate?: (data: V) => void,
  // 👇 error response callback
  onError?: (message?: string, id?: string) => void
) => {
  const [mutate, { loading, data, error, reset }] = useMutation<{
    [K in typeof query]: V;
  }>(gqlMutations[query], {
    // 👇 no cache use
    fetchPolicy: "no-cache",
    // errorPolicy: "all",
    update(_, result) {
      const data = result.data?.[query];
      // 👇 on successful response
      if (data) {
        onUpdate?.(data);
      }
    },
    onError(error) {
      // 👇 on error response
      const formatError = apolloErrorMessage(error, query);
      onError?.(formatError.message, formatError.id);
    },
  });

  return {
    // 👇 the mutation query
    query,
    // 👇  dismiss mutation result data or errors in the UI
    reset,
    // 👇 main mutate function
    mutate,
    // 👇 is mutate function processing
    loading,
    // 👇 mutation result
    data: data?.[query],
    // 👇 mutation error
    error: error ? apolloErrorMessage(error, query).message : error,
  };
};

// 👇 use subscription helper
export const USE_SUBSCRIPTION = <V,>(
  query: keyof typeof gqlSubscriptions,
  // 👇 subscription result callback
  callback: (data: V) => void
) => {
  const subscription = useSubscription<{
    [K in typeof query]: V;
  }>(gqlSubscriptions[query]);

  useEffect(() => {
    const { data, loading } = subscription;
    if (loading || !data) {
      return;
    }

    callback(data[query]);
  }, [subscription]);
};
