// 👇 Constants, Helpers & Types
import { WsAuth } from '../../src/api/v1/types';

declare module 'ws' {
  interface WebSocket {
    // 👇 manage user session on websocket
    session: Required<WsAuth> & {
      // 👇 link for checking if two socket clients have the same unique identifier
      link?: string;
    };
  }
}

export {};
