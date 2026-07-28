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

export function bindProjectRealtimeSocket({
  socket,
  projectId,
  onConnect,
  onDisconnect,
  onAny,
}: ProjectRealtimeBindingOptions): () => void {
  const handleConnect = () => {
    onConnect();
    socket.emit("project:join", { projectId });
  };

  socket.on("connect", handleConnect);
  socket.on("disconnect", onDisconnect);
  socket.onAny(onAny);

  if (socket.connected) {
    handleConnect();
  }

  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", onDisconnect);
    socket.offAny(onAny);
    socket.emit("project:leave", { projectId });
  };
}
