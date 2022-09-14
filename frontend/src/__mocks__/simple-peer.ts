// 👇 Services
import EventEmitter from "events";
import SimplePeer from "simple-peer";
// 👇 Constants, Helpers & Types
import { CallStatus } from "./utils/types";

// 👇 mock simple-peer server
export default class extends EventEmitter {
  constructor(options: SimplePeer.Options) {
    super();
    Object.defineProperty(this, "destroy", {
      value: jest.fn(),
      writable: true,
    });
    Object.defineProperty(this, "signal", {
      value: (signal: CallStatus) => {
        // 👇 emit stream event for user answering call
        if (signal === "ANSWER_OFFER") {
          this.emit("stream", "stream-data");
        }
      },
      writable: true,
    });

    this.addListener("signal", (signal: SimplePeer.SignalData) => {
      // console.log({ signal });
    });
    this.addListener("stream", (data: MediaStream) => {
      // console.log({ data });
    });
    this.addListener("close", () => {});

    // 👇 resolve to emit signal after component render
    Promise.resolve().then(() => {
      this.emit("signal", "signal-data");
    });
  }
}
