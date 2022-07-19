// 👇 Constants, Helpers & Types
import { SubscriptionContext } from '../../../src/api/v1/types';

declare module 'graphql-subscriptions' {
  interface ResolverFn {
    (rootValue?: any, args?: Record<string, string | number>, context: SubscriptionContext): AsyncIterator<any>;
  }
  interface FilterFn {
    (rootValue?: any, args?: Record<string, string | number>, context: SubscriptionContext): boolean | Promise<boolean>;
  }
}
export {};
