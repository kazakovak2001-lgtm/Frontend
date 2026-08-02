import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("./e2e-backend.mjs", import.meta.url);
const generatedUrl = new URL("./.e2e-backend-rbac.generated.mjs", import.meta.url);

const legacyBlock = `  await check("analytics module", async () => {
    const [system, agents, suggestions, cycle] = await Promise.all([
      request("/analytics/system"),
      request("/analytics/agents"),
      request("/analytics/suggestions"),
      request("/analytics/cycle", { method: "POST" }),
    ]);
    assert(
      system && agents && suggestions && cycle,
      "Analytics module returned an empty contract",
    );
  });
`;

const securedBlock = `  await check("analytics operator boundary", async () => {
    const [system, agents, suggestions, cycle] = await Promise.all([
      request("/analytics/system", {}, 403),
      request("/analytics/agents", {}, 403),
      request("/analytics/suggestions", {}, 403),
      request("/analytics/cycle", { method: "POST" }, 403),
    ]);
    assert(
      [system, agents, suggestions, cycle].every(
        (payload) =>
          payload.success === false &&
          payload.error === "Analytics operator access required",
      ),
      "Analytics operator boundary contract is invalid",
    );
  });
`;

const source = await readFile(sourceUrl, "utf8");
const occurrences = source.split(legacyBlock).length - 1;
if (occurrences !== 1) {
  throw new Error(
    `Expected exactly one legacy analytics contract block, found ${occurrences}`,
  );
}

await writeFile(generatedUrl, source.replace(legacyBlock, securedBlock), "utf8");

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(generatedUrl)], {
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`E2E contract terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} finally {
  await unlink(generatedUrl).catch(() => undefined);
}
