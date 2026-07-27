import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const DEFAULT_HEALTH_PATH = "/health";

export function createFrontendServer({
  worker,
  origin,
  publicRoot,
  healthPath = DEFAULT_HEALTH_PATH,
  cacheControl = "no-store",
}) {
  if (!worker || typeof worker.fetch !== "function") {
    throw new TypeError(
      "Frontend worker must expose fetch(request, env, context)",
    );
  }
  if (!origin) throw new TypeError("Frontend origin is required");
  if (!publicRoot) throw new TypeError("Frontend public root is required");

  const resolvedPublicRoot = path.resolve(publicRoot);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", origin);
      if (url.pathname === healthPath) {
        sendHealthResponse(request, response);
        return;
      }
      if (
        await servePublicAsset({
          request,
          response,
          pathname: url.pathname,
          publicRoot: resolvedPublicRoot,
          cacheControl,
        })
      ) {
        return;
      }

      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          value.forEach((item) => headers.append(name, item));
        } else if (value !== undefined) {
          headers.set(name, value);
        }
      }

      const hasBody = !["GET", "HEAD"].includes(request.method ?? "GET");
      const workerResponse = await worker.fetch(
        new Request(url, {
          method: request.method,
          headers,
          body: hasBody ? Readable.toWeb(request) : undefined,
          duplex: hasBody ? "half" : undefined,
        }),
        {},
        createExecutionContext(),
      );

      response.statusCode = workerResponse.status;
      workerResponse.headers.forEach((value, name) =>
        response.setHeader(name, value),
      );
      if (workerResponse.body)
        Readable.fromWeb(workerResponse.body).pipe(response);
      else response.end();
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end(error instanceof Error ? error.stack : String(error));
    }
  });
}

export function listenServer(server, { port, host = "127.0.0.1" }) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

export function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function sendHealthResponse(request, response) {
  const payload = JSON.stringify({
    status: "healthy",
    service: "roblox-ai-studio-frontend",
  });
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(request.method === "HEAD" ? undefined : payload);
}

async function servePublicAsset({
  request,
  response,
  pathname,
  publicRoot,
  cacheControl,
}) {
  if (!["GET", "HEAD"].includes(request.method ?? "GET")) return false;

  const candidate = path.resolve(
    publicRoot,
    `.${decodeURIComponent(pathname)}`,
  );
  if (
    candidate === publicRoot ||
    !candidate.startsWith(`${publicRoot}${path.sep}`)
  ) {
    return false;
  }

  try {
    const content = await readFile(candidate);
    response.statusCode = 200;
    response.setHeader("content-type", contentType(candidate));
    response.setHeader("cache-control", cacheControl);
    response.end(request.method === "HEAD" ? undefined : content);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error.code === "ENOENT" || error.code === "EISDIR")
    ) {
      return false;
    }
    throw error;
  }
}

function createExecutionContext() {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

function contentType(filename) {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[path.extname(filename).toLowerCase()] ?? "application/octet-stream"
  );
}
