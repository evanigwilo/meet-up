// 👇 Services
import { WebSocket, Event } from "ws";
// 👇 Constants, Helpers & Types
import { CallStatus } from "./utils/types";
import { uploadId, userCalling } from "./utils/constants";
import {
  constructMessage,
  deconstructMessage,
  testObserver,
} from "../utils/helpers";
import { serverName } from "../utils/constants";
import { KeyValue, UploadType } from "../utils/types";

// 👇 mock websocket server
export default class extends WebSocket {
  constructor(url: string) {
    super(null);
    const { searchParams } = new URL(url);
    const token = searchParams.get("token") as CallStatus;

    this.addListener("error", (error) => {
      // console.log({ error });
      // this.onopen?.(null as any);
    });
    this.addListener("open", (data: any) => {
      // console.log({ data });
      // this.onopen?.(null as any);
    });
    this.addListener("message", (message) => {
      // console.log({ message });
      // this.onopen?.(null as any);
    });

    Object.defineProperty(this, "send", {
      value: (message: string) => {
        const { type, content, to } = deconstructMessage(message);
        switch (type) {
          case "MESSAGE":
          case UploadType.MESSAGE_IMAGE:
          case UploadType.MESSAGE_MEDIA:
          case UploadType.POST_IMAGE:
          case UploadType.POST_MEDIA:
          case UploadType.REPLY_IMAGE:
          case UploadType.REPLY_MEDIA:
            // 👇 send unique id to client
            (content as KeyValue).id = uploadId;
            this.emit(
              "message",
              constructMessage({
                type,
                content,
              })
            );
            break;

          case "ONLINE":
            this.emit(
              "message",
              constructMessage({
                type,
                content: {
                  id: to,
                  online: "ONLINE",
                },
                from: serverName,
              })
            );
            break;

          case "CALL_OFFER":
            this.emit(
              "message",
              constructMessage({
                type: token,
                from: serverName,
                content: token,
              })
            );
            /*
            // 👇 user offline
            this.emit(
              "message",
              constructMessage({
                type: "USER_OFFLINE",
                from: serverName,
              })
            );
            
            // 👇 is user offline
            this.emit(
              "message",
              constructMessage({
                type: "UNAUTHENTICATED",
                from: serverName,
              })
            );
          */
            break;

          default:
            break;
        }
      },
      writable: true,
    });

    Promise.resolve().then(() => {
      Object.defineProperty(this, "readyState", {
        get: () => this.OPEN,
      });
      testObserver("WS_OPEN");
      this.onopen?.(null as unknown as Event);
      // 👇 simulate incoming call
      if (token === "CALL_OFFER") {
        this.emit(
          "message",
          constructMessage({
            type: token,
            content: {
              signal: "signal-data",
              name: userCalling.name,
            },
            from: userCalling.id,
          })
        );
      }
    });
  }
}
