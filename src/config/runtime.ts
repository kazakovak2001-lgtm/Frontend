export interface RuntimeEndpointEnvironment {
  VITE_API_URL?: string;
  VITE_SOCKET_URL?: string;
}

export interface RuntimeEndpoints {
  apiBaseUrl: string;
  socketBaseUrl: string;
}

const DEFAULT_API_URL = "http://localhost:5000/api";

function normalizeHttpUrl(value: string, variableName: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTP(S) URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must use HTTP or HTTPS`);
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function resolveRuntimeEndpoints(
  environment: RuntimeEndpointEnvironment,
): RuntimeEndpoints {
  const apiBaseUrl = normalizeHttpUrl(
    environment.VITE_API_URL ?? DEFAULT_API_URL,
    "VITE_API_URL",
  );

  const socketBaseUrl = environment.VITE_SOCKET_URL
    ? normalizeHttpUrl(environment.VITE_SOCKET_URL, "VITE_SOCKET_URL")
    : new URL(apiBaseUrl).origin;

  return { apiBaseUrl, socketBaseUrl };
}

const viteEnvironment =
  (import.meta as ImportMeta & { env?: RuntimeEndpointEnvironment }).env ?? {};

export const runtimeEndpoints = resolveRuntimeEndpoints(viteEnvironment);
