import path from "node:path";
import worker from "../../.output/server/index.mjs";
import {
  closeServer,
  createFrontendServer,
  listenServer,
} from "./frontend-node-server.mjs";

const port = parsePort(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "0.0.0.0";
const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`;
const publicRoot = path.resolve(".output/public");

const server = createFrontendServer({
  worker,
  origin: publicOrigin,
  publicRoot,
  cacheControl: "no-store",
});

await listenServer(server, { port, host });
console.log(
  JSON.stringify({
    event: "frontend.started",
    host,
    port,
    publicOrigin,
  }),
);

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await closeServer(server);
      process.exitCode = 0;
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new RangeError(`Invalid PORT value: ${value}`);
  }
  return parsed;
}
