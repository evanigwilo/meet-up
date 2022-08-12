// 👇 React
import { createContext, useLayoutEffect, useContext, useReducer } from "react";
// 👇 Custom hooks
import { USE_QUERY } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { sleep, testObserver } from "../utils/helpers";
import { ActionType } from "../utils/types/enum";
import { Action, DispatchCreator, Store, UserType } from "../utils/types";

// 👇 default store
const store: Store = {
  modal: {
    disabled: false,
    logo: true,
    text: true,
    visible: true,
  },
};

// 👇 store context
const StoreContext = createContext<Store>(store);
// 👇 dispatch context
const DispatchContext = createContext<DispatchCreator>(() => undefined);

// 👇 store reducer from managing store state
const reducer = (state: Store, { type, payload }: Action): Store => {
  switch (type) {
    case ActionType.SHOW_MODAL: {
      return {
        ...state,
        modal: store.modal,
      };
    }

    case ActionType.HIDE_MODAL: {
      return {
        ...state,
        modal: {
          disabled: true,
          visible: false,
        },
      };
    }

    case ActionType.UPDATE_NOTIFICATION: {
      const { user } = state;
      if (!user) {
        return state;
      }

      return {
        ...state,
        user: {
          ...user,
          // 👇 payload can be negative so should never go below 0
          notifications: Math.max(0, user.notifications + (payload as number)),
        },
      };
    }

    case ActionType.UPDATE_CONVERSATION: {
      const { user } = state;
      if (!user) {
        return state;
      }

      return {
        ...state,
        user: {
          ...user,
          conversations: payload as number,
        },
      };
    }

    case ActionType.TOGGLE_NOTIFICATION: {
      const { user } = state;
      if (!user) {
        return state;
      }

      const toggle = payload as boolean;
      return {
        ...state,
        user: {
          ...user,
          notification: toggle,
        },
      };
    }

    case ActionType.AUTHENTICATED:
      const user = payload as UserType | undefined;

      if (!user) {
        return {
          ...state,
          authenticating: false,
          user,
        };
      }

      let notifications = 0;
      let conversations = 0;
      user.notifications?.forEach(({ type, total }) => {
        if (type === "CONVERSATIONS") {
          conversations = total;
        } else {
          notifications += total;
        }
      });

      const userCopy = { ...user } as unknown as Store["user"];
      // 👇 not needed for context
      delete (userCopy as unknown as Partial<UserType>).notifications;

      userCopy!.notifications = notifications;
      userCopy!.conversations = conversations;

      return {
        ...state,
        authenticating: false,
        user: userCopy,
      };

    case ActionType.AUTHENTICATING:
      return {
        ...state,
        authenticating: true,
      };

    case ActionType.ANSWER:
      return {
        ...state,
        answer: payload,
      };

    case ActionType.CHAT:
      return {
        ...state,
        chat: payload,
      };

    case ActionType.PLAYING:
      return {
        ...state,
        media: payload,
      };

    case ActionType.REPLYING:
      return {
        ...state,
        reply: payload,
      };

    default:
      return state;
  }
};

const Provider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, store);

  const dispatchCallback: DispatchCreator = (type: ActionType, payload?: any) =>
    dispatch({ type, payload });

  const AUTH = USE_QUERY<UserType>(false, "auth");

  useLayoutEffect(() => {
    dispatchCallback(ActionType.AUTHENTICATING);

    // 👇 authenticate user on initial load
    AUTH.fetch().then(({ data }) => {
      testObserver("AUTHENTICATION");
      dispatchCallback(ActionType.AUTHENTICATED, data?.auth || undefined);
    });

    /* 
      dispatchCallback(ActionType.SHOW_MODAL); 
    */

    // 👇 hide loading modal after 1 sec
    sleep(1).then(() => {
      testObserver("HIDE_MODAL");
      dispatchCallback(ActionType.HIDE_MODAL);
    });
  }, []);

  return (
    <DispatchContext.Provider value={dispatchCallback}>
      <StoreContext.Provider value={state}>{children}</StoreContext.Provider>
    </DispatchContext.Provider>
  );
};

export default Provider;
// 👇 store context helpers
export const useStore = () => useContext(StoreContext);
export const useDispatch = () => useContext(DispatchContext);
