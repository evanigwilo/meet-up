// 👇 React
import { useLayoutEffect } from "react";
// 👇 Context
import { useWs } from "../providers/ws";
// 👇 Constants, Helpers & Types
import { SocketMessage } from "../utils/types";
import { deconstructMessage } from "../utils/helpers";

// 👇 websocket messaging hook
export const useWsMessage = (
  callback: (message: SocketMessage) => void,
  deps: React.DependencyList = []
) => {
  const ws = useWs();

  useLayoutEffect(() => {
    if (!ws) {
      return;
    }

    const messageListener: typeof ws.onmessage = ({ data }) => {
      const message = deconstructMessage(data.toString());
      callback(message);
    };

    ws.addEventListener("message", messageListener);

    // 👇 remove listener on unmount
    return () => ws.removeEventListener("message", messageListener);
  }, [ws, ...deps]);
};
