export type RealtimeAnyHandler = (event: string, payload: unknown) => void;

export interface ProjectRealtimeSocket {
  readonly connected: boolean;
  on(event: "connect" | "disconnect", handler: () => void): unknown;
  off(event: "connect" | "disconnect", handler: () => void): unknown;
  onAny(handler: RealtimeAnyHandler): unknown;
  offAny(handler: RealtimeAnyHandler): unknown;
  emit(event: string, payload: { projectId: string }): unknown;
}

export interface ProjectRealtimeBindingOptions {
  socket: ProjectRealtimeSocket;
  projectId: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onAny: RealtimeAnyHandler;
}

function payloadProjectId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const projectId = (payload as { projectId?: unknown }).projectId;
  return typeof projectId === "string" ? projectId : undefined;
}

export function bindProjectRealtimeSocket({
  socket,
  projectId,
  onConnect,
  onDisconnect,
  onAny,
}: ProjectRealtimeBindingOptions): () => void {
  const requestProjectJoin = () => {
    socket.emit("project:join", { projectId });
  };

  const handleAny: RealtimeAnyHandler = (event, payload) => {
    if (payloadProjectId(payload) === projectId) {
      if (event === "project:joined") {
        onConnect();
      } else if (event === "project:error") {
        onDisconnect();
      }
    }
    onAny(event, payload);
  };

  socket.on("connect", requestProjectJoin);
  socket.on("disconnect", onDisconnect);
  socket.onAny(handleAny);

  if (socket.connected) {
    requestProjectJoin();
  }

  return () => {
    socket.off("connect", requestProjectJoin);
    socket.off("disconnect", onDisconnect);
    socket.offAny(handleAny);
    socket.emit("project:leave", { projectId });
  };
}
