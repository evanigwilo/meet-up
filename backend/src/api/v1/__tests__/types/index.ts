// 👇 Constants, Helpers & Types
import { KeyValue } from '../../types';
import { gqlMutations, gqlQueries } from '../constants';
import { graphQLRequest, httpRequest, loginUser } from '../helpers';

export type Variables = Record<string, string | number | boolean | KeyValue<string | number | boolean>>;

export type GqlQueries = keyof typeof gqlQueries;
export type GqlMutations = keyof typeof gqlMutations;

export type GqlError = {
  message: string;
  extensions: {
    code: string;
    exception: {
      stacktrace: KeyValue[];
    };
  } & KeyValue; // custom error extensions
};

export type GraphQLRequest = Awaited<ReturnType<typeof graphQLRequest>>;
export type HttpRequest = Awaited<ReturnType<typeof httpRequest>>;

export type LoginUser = Awaited<ReturnType<typeof loginUser>>;

export type Follow = {
  followers: number;
  following: number;
};