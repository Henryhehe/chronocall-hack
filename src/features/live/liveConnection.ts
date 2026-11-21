import type { LiveClientMessage, LiveServerEvent } from "../../../shared/live.ts";

export type LiveSocket = Pick<WebSocket, "readyState" | "onmessage" | "onerror" | "onclose" | "send" | "close">;

interface LiveCallbacks {
  onReady: () => void;
  onMessage: (message: LiveServerEvent) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/** Browser transport is open before Gemini is ready. Only server readiness enables input. */
export class LiveConnection {
  private ready = false;
  private closed = false;
  private socket: LiveSocket;
  private callbacks: LiveCallbacks;

  constructor(socket: LiveSocket, callbacks: LiveCallbacks) {
    this.socket = socket;
    this.callbacks = callbacks;
    socket.onmessage = ({ data }) => {
      if (this.closed) return;
      let message: LiveServerEvent;
      try { message = JSON.parse(data); } catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.type === "status") {
        if (message.status === "connected" && !this.ready) {
          this.ready = true;
          callbacks.onReady();
        } else if (message.status === "closed") this.close();
      } else if (message.type === "error") {
        callbacks.onError(message.message);
        this.close();
      } else callbacks.onMessage(message);
    };
    socket.onerror = () => {
      if (this.closed) return;
      callbacks.onError("Live connection failed. Check that the server is running.");
      this.close();
    };
    socket.onclose = () => this.close();
  }

  send(message: LiveClientMessage): boolean {
    if (this.closed || !this.ready || this.socket.readyState !== 1) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    this.socket.close();
    this.callbacks.onClose();
  }
}
