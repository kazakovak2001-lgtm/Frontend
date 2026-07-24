import { io, type Socket } from "socket.io-client";

function resolveSocketUrl() {
  const configuredSocket = import.meta.env.VITE_SOCKET_URL as
    string | undefined;
  if (configuredSocket) return configuredSocket.replace(/\/$/, "");

  const configuredApi = import.meta.env.VITE_API_URL as string | undefined;
  if (configuredApi) {
    try {
      return new URL(configuredApi).origin;
    } catch {
      // The API adapter will surface an invalid URL with request context.
    }
  }
  return "http://localhost:5000";
}

const SOCKET_URL = resolveSocketUrl();

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
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
  return SOCKET_URL;
}
