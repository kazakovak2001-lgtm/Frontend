import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindProjectRealtimeSocket,
  type ProjectRealtimeSocket,
  type RealtimeAnyHandler,
} from "../src/services/projectRealtimeBinding.ts";

class FakeProjectSocket implements ProjectRealtimeSocket {
  connected = false;
  readonly emissions: Array<{ event: string; projectId: string }> = [];
  private readonly eventHandlers = new Map<string, Set<() => void>>();
  private readonly anyHandlers = new Set<RealtimeAnyHandler>();

  on(event: "connect" | "disconnect", handler: () => void) {
    const handlers = this.eventHandlers.get(event) ?? new Set<() => void>();
    handlers.add(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: "connect" | "disconnect", handler: () => void) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  onAny(handler: RealtimeAnyHandler) {
    this.anyHandlers.add(handler);
  }

  offAny(handler: RealtimeAnyHandler) {
    this.anyHandlers.delete(handler);
  }

  emit(event: string, payload: { projectId: string }) {
    this.emissions.push({ event, projectId: payload.projectId });
  }

  trigger(event: "connect" | "disconnect") {
    this.connected = event === "connect";
    for (const handler of this.eventHandlers.get(event) ?? []) {
      handler();
    }
  }

  triggerAny(event: string, payload: unknown) {
    for (const handler of this.anyHandlers) {
      handler(event, payload);
    }
  }
}

test("becomes room-ready only after project:joined and rejoins after reconnect", () => {
  const socket = new FakeProjectSocket();
  const connectionStates: boolean[] = [];
  const events: Array<{ event: string; payload: unknown }> = [];

  const cleanup = bindProjectRealtimeSocket({
    socket,
    projectId: "project-42",
    onConnect: () => connectionStates.push(true),
    onDisconnect: () => connectionStates.push(false),
    onAny: (event, payload) => events.push({ event, payload }),
  });

  socket.trigger("connect");
  assert.deepEqual(connectionStates, []);
  assert.deepEqual(socket.emissions, [
    { event: "project:join", projectId: "project-42" },
  ]);

  socket.triggerAny("project:joined", { projectId: "other-project" });
  assert.deepEqual(connectionStates, []);

  socket.triggerAny("project:joined", { projectId: "project-42" });
  socket.triggerAny("pipeline.started", { projectId: "project-42" });
  socket.trigger("disconnect");
  socket.trigger("connect");

  assert.deepEqual(connectionStates, [true, false]);
  assert.deepEqual(socket.emissions, [
    { event: "project:join", projectId: "project-42" },
    { event: "project:join", projectId: "project-42" },
  ]);

  socket.triggerAny("project:joined", { projectId: "project-42" });
  assert.deepEqual(connectionStates, [true, false, true]);
  assert.deepEqual(events, [
    {
      event: "project:joined",
      payload: { projectId: "other-project" },
    },
    {
      event: "project:joined",
      payload: { projectId: "project-42" },
    },
    {
      event: "pipeline.started",
      payload: { projectId: "project-42" },
    },
    {
      event: "project:joined",
      payload: { projectId: "project-42" },
    },
  ]);

  cleanup();
  assert.deepEqual(socket.emissions.at(-1), {
    event: "project:leave",
    projectId: "project-42",
  });

  socket.trigger("connect");
  socket.triggerAny("pipeline.completed", { projectId: "project-42" });
  assert.equal(
    socket.emissions.filter(({ event }) => event === "project:join").length,
    2,
  );
  assert.equal(events.length, 4);
});

test("requests a join immediately for an already connected transport", () => {
  const socket = new FakeProjectSocket();
  socket.connected = true;
  let roomReadyCalls = 0;

  const cleanup = bindProjectRealtimeSocket({
    socket,
    projectId: "project-live",
    onConnect: () => {
      roomReadyCalls += 1;
    },
    onDisconnect: () => undefined,
    onAny: () => undefined,
  });

  assert.equal(roomReadyCalls, 0);
  assert.deepEqual(socket.emissions[0], {
    event: "project:join",
    projectId: "project-live",
  });

  socket.triggerAny("project:joined", { projectId: "project-live" });
  assert.equal(roomReadyCalls, 1);
  cleanup();
});

test("marks the project room unavailable when the server rejects the join", () => {
  const socket = new FakeProjectSocket();
  const connectionStates: boolean[] = [];

  const cleanup = bindProjectRealtimeSocket({
    socket,
    projectId: "project-denied",
    onConnect: () => connectionStates.push(true),
    onDisconnect: () => connectionStates.push(false),
    onAny: () => undefined,
  });

  socket.trigger("connect");
  socket.triggerAny("project:error", {
    projectId: "project-denied",
    error: "Project access denied",
  });

  assert.deepEqual(connectionStates, [false]);
  cleanup();
});
