import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("./e2e-backend.mjs", import.meta.url);
const generatedUrl = new URL("./.e2e-backend-rbac.generated.mjs", import.meta.url);

const replacements = [
  {
    name: "analytics",
    legacy: `  await check("analytics module", async () => {
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
`,
    secured: `  await check("analytics operator boundary", async () => {
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
`,
  },
  {
    name: "controller",
    legacy: `  await check("AI project controller", async () => {
    const [health, preCheck, architecture, duplicates] = await Promise.all([
      request("/controller/health"),
      request(
        "/controller/pre-check",
        json("POST", {
          intent: \`Validate \${project.name}\`,
          name: project.name,
          type: "project",
        }),
      ),
      request(
        "/controller/architecture/scan",
        json("POST", { action: "validate" }),
      ),
      request(
        "/controller/duplicates/check",
        json("POST", {
          name: project.name,
          description: project.description,
          category: project.genre,
          exports: [],
        }),
      ),
    ]);
    assert(
      health && preCheck && architecture && duplicates,
      "Controller contract is incomplete",
    );
  });
`,
    secured: `  await check("controller operator boundary", async () => {
    const [health, preCheck, architecture, duplicates] = await Promise.all([
      request("/controller/health", {}, 403),
      request(
        "/controller/pre-check",
        json("POST", {
          intent: \`Validate \${project.name}\`,
          name: project.name,
          type: "project",
        }),
        403,
      ),
      request(
        "/controller/architecture/scan",
        json("POST", { action: "validate" }),
        403,
      ),
      request(
        "/controller/duplicates/check",
        json("POST", {
          name: project.name,
          description: project.description,
          category: project.genre,
          exports: [],
        }),
        403,
      ),
    ]);
    assert(
      [health, preCheck, architecture, duplicates].every(
        (payload) =>
          payload.success === false &&
          payload.error === "Controller operator access required",
      ),
      "Controller operator boundary contract is invalid",
    );
  });
`,
  },
];

let generated = await readFile(sourceUrl, "utf8");
for (const replacement of replacements) {
  const occurrences = generated.split(replacement.legacy).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one legacy ${replacement.name} contract block, found ${occurrences}`,
    );
  }
  generated = generated.replace(replacement.legacy, replacement.secured);
}

await writeFile(generatedUrl, generated, "utf8");

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
