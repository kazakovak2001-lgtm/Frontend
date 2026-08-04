import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceUrl = new URL("./e2e-backend.mjs", import.meta.url);
const generatedUrl = new URL(
  "./.e2e-backend-rbac.generated.mjs",
  import.meta.url,
);

const replacements = [
  [
    "analytics module",
    `  await check("analytics module", async () => {
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
    `  await check("analytics operator boundary", async () => {
    const payloads = await Promise.all([
      request("/analytics/system", {}, 403),
      request("/analytics/agents", {}, 403),
      request("/analytics/suggestions", {}, 403),
      request("/analytics/cycle", { method: "POST" }, 403),
    ]);
    assert(
      payloads.every(
        (payload) =>
          payload.success === false &&
          payload.error === "Analytics operator access required",
      ),
      "Analytics operator boundary contract is invalid",
    );
  });
`,
  ],
  [
    "controller",
    `  await check("AI project controller", async () => {
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
    `  await check("controller operator boundary", async () => {
    const payloads = await Promise.all([
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
      payloads.every(
        (payload) =>
          payload.success === false &&
          payload.error === "Controller operator access required",
      ),
      "Controller operator boundary contract is invalid",
    );
  });
`,
  ],
  [
    "memory and evaluation",
    `  await check("memory and evaluation modules", async () => {
    await request(
      "/memory/store",
      json("POST", {
        agentId: "e2e",
        projectId: project.id,
        input: { project: project.name },
        output: { verified: true },
        tags: ["e2e"],
      }),
    );
    const [memory, stats, evaluation, evaluationHistory] = await Promise.all([
      request(
        "/memory/search",
        json("POST", {
          agentId: "e2e",
          projectId: project.id,
          query: project.name,
        }),
      ),
      request("/memory/system/stats"),
      request("/evaluation/run", json("POST", {})),
      request("/evaluation/history"),
    ]);
    assert(
      memory && stats.store && evaluation && evaluationHistory.summaries,
      "Memory or evaluation contract is incomplete",
    );
  });
`,
    `  await check("memory project access and operator boundaries", async () => {
    await request(
      "/memory/store",
      json("POST", {
        agentId: "e2e",
        projectId: project.id,
        input: { project: project.name },
        output: { verified: true },
        tags: ["e2e"],
      }),
    );
    const [memory, stats, evaluation, evaluationHistory] = await Promise.all([
      request(
        "/memory/search",
        json("POST", {
          agentId: "e2e",
          projectId: project.id,
          query: project.name,
        }),
      ),
      request("/memory/system/stats", {}, 403),
      request("/evaluation/run", json("POST", {}), 403),
      request("/evaluation/history", {}, 403),
    ]);
    assert(memory, "Project-scoped memory search contract is incomplete");
    assert(
      stats.success === false && stats.error === "Memory operator access required",
      "Memory operator boundary contract is invalid",
    );
    assert(
      [evaluation, evaluationHistory].every(
        (payload) =>
          payload.success === false &&
          payload.error === "Evaluation operator access required",
      ),
      "Evaluation operator boundary contract is invalid",
    );
  });
`,
  ],
  [
    "distributed",
    `  await check("distributed runtime and diagnostics", async () => {
    const [cluster, queue, workers, submitted, traces] = await Promise.all([
      request("/distributed/cluster"),
      request("/distributed/queue"),
      request("/distributed/workers"),
      request(
        "/distributed/submit",
        json("POST", {
          intent: \`Validate distributed execution for \${project.name}\`,
          projectId: project.id,
          priority: "normal",
        }),
      ),
      request("/debug/executions"),
    ]);
    const terminalJob = await waitForTerminalStatus(
      \`/distributed/job/\${submitted.jobId}\`,
      \`Distributed job \${submitted.jobId}\`,
    );
    assert(
      cluster.totalWorkers > 0 &&
        queue &&
        workers.count > 0 &&
        submitted.jobId &&
        terminalJob.status === "completed" &&
        Array.isArray(traces.executions),
      "Distributed runtime or diagnostics contract is incomplete",
    );
  });
`,
    `  await check("distributed operator boundary and project submission", async () => {
    const [cluster, queue, workers, traces, submitted] = await Promise.all([
      request("/distributed/cluster", {}, 403),
      request("/distributed/queue", {}, 403),
      request("/distributed/workers", {}, 403),
      request("/debug/executions", {}, 403),
      request(
        "/distributed/submit",
        json("POST", {
          intent: \`Validate distributed execution for \${project.name}\`,
          projectId: project.id,
          priority: "normal",
        }),
      ),
    ]);
    assert(submitted.jobId, "Distributed project submission contract is incomplete");
    assert(
      [cluster, queue, workers].every(
        (payload) =>
          payload.success === false &&
          payload.error === "Distributed operator access required",
      ),
      "Distributed operator boundary contract is invalid",
    );
    assert(
      traces.success === false && traces.error === "Debug operator access required",
      "Debug operator boundary contract is invalid",
    );
  });
`,
  ],
];

let generated = await readFile(sourceUrl, "utf8");
for (const [name, legacy, secured] of replacements) {
  const occurrences = generated.split(legacy).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one legacy ${name} contract block, found ${occurrences}`,
    );
  }
  generated = generated.replace(legacy, secured);
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
