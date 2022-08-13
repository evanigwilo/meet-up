// 👇 React
import {
  createContext,
  useLayoutEffect,
  useContext,
  useState,
  useCallback,
} from "react";
// 👇 WebSocket
import WebSocket from "isomorphic-ws";
// 👇 Context
import ContextProvider from "./context";
// 👇 Custom hooks
import { USE_QUERY } from "../hooks/useApollo";
// 👇 Constants, Helpers & Types
import { apiUrl, sleep, testObserver } from "../utils/helpers";
import { UserType } from "../utils/types";

// 👇 websocket context
const WsContext = createContext<WebSocket | null>(null);

// 👇 websocket url
const wsUrl = (token?: string) => `${apiUrl(true, true)}?token=${token}`;

const Provider = ({ children }: { children: React.ReactNode }) => {
  const [wsClient, updateWsClient] = useState<WebSocket | null>(null);

  const AUTH = USE_QUERY<UserType>(false, "auth");

  // 👇 websocket events handler
  const wsConnect = useCallback(
    async (url: string, retries: number = 1, interval: boolean = true) => {
      // 👇 try reconnect on every failed connection for 5 mins (100 calls after 3 secs interval)
      if (retries > 100) {
        return;
      } else if (interval) {
        await sleep(3);
      }

      const ws = new WebSocket(url);

      ws.onopen = () => {
        ws.onclose = ({ code, reason }) => {
          // 👇 reload page condition
          if (code === 1000 && reason === "UNAUTHENTICATED") {
            window.location.reload();
          } else {
            wsConnect(url);
          }
        };
        // 👇 update socket client on connect
        updateWsClient(ws);
      };

      // 👇 reconnect on error
      ws.onerror = () => wsConnect(url, retries + 1);

      /*
      client.onmessage = ({ data }) => {
        const { type, content } = deconstructMessage(data.toString());
      };
      */
    },
    []
  );

  useLayoutEffect(() => {
    // 👇 on initial load, authenticate user and connect to socket using auth token
    AUTH.fetch().then(({ data }) => {
      testObserver("AUTHENTICATION");
      const token = data?.auth.token;
      if (token) {
        wsConnect(wsUrl(token), 1, false);
      }
    });
  }, []);

  return (
    <WsContext.Provider value={wsClient}>
      <ContextProvider>{children}</ContextProvider>
    </WsContext.Provider>
  );
};

export default Provider;

// 👇 websocket context helpers
export const useWs = () => useContext(WsContext);
