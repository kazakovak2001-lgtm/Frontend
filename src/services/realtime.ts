import { io, type Socket } from "socket.io-client";
import { runtimeEndpoints } from "@/config/runtime";

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(runtimeEndpoints.socketBaseUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
    });
  }
  return socket;
}

export function disconnectRealtimeSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocketBaseUrl() {
  return runtimeEndpoints.socketBaseUrl;
}
