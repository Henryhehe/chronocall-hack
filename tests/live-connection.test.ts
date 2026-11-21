import test from "node:test";
import assert from "node:assert/strict";
import { LiveConnection, type LiveSocket } from "../src/features/live/liveConnection.ts";

function harness() {
  const sent: string[] = [];
  let ready = 0, closed = 0, socketClosed = 0;
  const errors: string[] = [];
  const socket: LiveSocket = { readyState: 1, onmessage: null, onerror: null, onclose: null,
    send: (data) => { sent.push(String(data)); }, close: () => { socketClosed++; } };
  const connection = new LiveConnection(socket, {
    onReady: () => { ready++; }, onMessage: () => {},
    onError: (message) => errors.push(message), onClose: () => { closed++; },
  });
  const receive = (message: unknown) => socket.onmessage?.call(socket as WebSocket, new MessageEvent("message", { data: JSON.stringify(message) }));
  return { socket, connection, receive, sent, errors, counts: () => ({ ready, closed, socketClosed }) };
}

test("an open transport cannot send audio until Gemini confirms readiness", () => {
  const h = harness();
  assert.equal(h.connection.send({ type: "audio", data: "pcm" }), false);
  h.receive({ type: "status", status: "connecting" });
  assert.equal(h.connection.send({ type: "text", text: "hello" }), false);
  h.receive({ type: "status", status: "connected" });
  h.receive({ type: "status", status: "connected" });
  assert.equal(h.counts().ready, 1);
  assert.equal(h.connection.send({ type: "video", data: "frame" }), true);
  assert.deepEqual(h.sent.map((item) => JSON.parse(item)), [{ type: "video", data: "frame" }]);
});

test("upstream closure stops sending and tears down exactly once", () => {
  const h = harness();
  h.receive({ type: "status", status: "connected" });
  h.receive({ type: "status", status: "closed" });
  h.connection.close();
  assert.equal(h.connection.send({ type: "audio", data: "pcm" }), false);
  assert.deepEqual(h.counts(), { ready: 1, closed: 1, socketClosed: 1 });
  assert.equal(h.socket.onmessage, null);
});

test("late readiness after cancellation cannot restart input", () => {
  const h = harness();
  const staleCallback = h.socket.onmessage;
  h.connection.close();
  staleCallback?.call(h.socket as WebSocket, new MessageEvent("message", { data: JSON.stringify({ type: "status", status: "connected" }) }));
  assert.equal(h.counts().ready, 0);
  assert.equal(h.connection.send({ type: "text", text: "late" }), false);
});

test("provider errors are visible and close the transport", () => {
  const h = harness();
  h.receive({ type: "error", message: "API key rejected" });
  assert.deepEqual(h.errors, ["API key rejected"]);
  assert.equal(h.counts().closed, 1);
});
