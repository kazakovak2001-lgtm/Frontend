import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const frontendOrigin =
  process.env.INT1B_FRONTEND_ORIGIN ?? "http://127.0.0.1:4173";
const apiUrl = process.env.INT1B_API_URL ?? "http://127.0.0.1:5051/api";
const backendImage =
  process.env.INT1B_BACKEND_IMAGE ?? "roblox-ai-studio-backend:int-1b";
const databaseUrl = process.env.INT1B_DATABASE_URL;
const backendName =
  process.env.INT1B_BACKEND_CONTAINER ?? "roblox-ai-studio-backend-int-1b";
const artifactDir =
  process.env.INT1B_ARTIFACT_DIR ?? "artifacts/int-1b-restart";

if (!databaseUrl) throw new Error("INT1B_DATABASE_URL is required");

await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const browserDiagnostics = [];
let phase = "bootstrap";

page.on("console", (message) => {
  if (message.type() === "error") {
    browserDiagnostics.push({
      source: "console",
      phase,
      message: message.text(),
    });
  }
});
page.on("pageerror", (error) => {
  browserDiagnostics.push({
    source: "pageerror",
    phase,
    message: error.message,
  });
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `int1b-${suffix}@example.com`;
const password = "Integration1B!123";
const projectName = `Restart Recovery ${suffix}`;

async function api(path) {
  return page.evaluate(
    async ({ url }) => {
      const response = await fetch(url, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(`${response.status}: ${JSON.stringify(body)}`);
      }
      return body.data ?? body;
    },
    { url: `${apiUrl}${path}` },
  );
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/api$/, "")}/health`);
      if (response.ok) return;
    } catch {
      // Backend is expected to be unavailable during restart.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Backend did not become healthy after restart");
}

function restartBackend() {
  execFileSync("docker", ["rm", "--force", backendName], {
    stdio: "inherit",
  });
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      backendName,
      "--network",
      "host",
      "--env",
      "NODE_ENV=production",
      "--env",
      "PORT=5051",
      "--env",
      "STORAGE_PROVIDER=postgres",
      "--env",
      `DATABASE_URL=${databaseUrl}`,
      "--env",
      `FRONTEND_URL=${frontendOrigin}`,
      backendImage,
    ],
    { stdio: "inherit" },
  );
}

function isExpectedDiagnostic(diagnostic) {
  if (
    diagnostic.source === "console" &&
    /Failed to load resource: the server responded with a status of (400|401|409)/.test(
      diagnostic.message,
    )
  ) {
    return true;
  }

  return (
    diagnostic.source === "console" &&
    diagnostic.phase === "restart" &&
    diagnostic.message.includes("ERR_CONNECTION_REFUSED")
  );
}

try {
  await page.goto(`${frontendOrigin}/register`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Full name").fill("Integration Recovery");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByText("I agree to the Terms of Service").click();
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);

  phase = "generation";
  await page.goto(`${frontendOrigin}/projects/new`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Project name").fill(projectName);
  await page
    .getByLabel("Description")
    .fill(
      "A deterministic integration fixture used to verify PostgreSQL-backed backend restart recovery.",
    );

  await Promise.all([
    page.waitForURL(
      (url) => {
        const segments = url.pathname.split("/").filter(Boolean);
        return (
          segments.length === 2 &&
          segments[0] === "projects" &&
          segments[1] !== "new"
        );
      },
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Generate game" }).click(),
  ]);

  const projectId = new URL(page.url()).pathname
    .split("/")
    .filter(Boolean)
    .at(-1);
  if (!projectId) {
    throw new Error("Project id was not present in workspace URL");
  }

  let historyBefore = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    historyBefore = await api(
      `/projects/${encodeURIComponent(projectId)}/history`,
    );
    if (historyBefore.length > 0) break;
    await page.waitForTimeout(500);
  }
  if (historyBefore.length !== 1) {
    const failureEvidence = {
      phase,
      frontendOrigin,
      apiUrl,
      projectId,
      pageUrl: page.url(),
      historyCountBefore: historyBefore.length,
      browserDiagnostics,
    };
    await writeFile(
      `${artifactDir}/generation-start-failure.json`,
      `${JSON.stringify(failureEvidence, null, 2)}\n`,
    );
    throw new Error(
      `Expected one generation record before restart, received ${historyBefore.length}; browser diagnostics: ${JSON.stringify(browserDiagnostics)}`,
    );
  }
  const executionId = historyBefore[0].pipelineId;
  if (!executionId) {
    throw new Error("Generation history did not expose a pipeline id");
  }

  // Exercise both real workspace forms against the PostgreSQL-backed API
  // before restarting the backend, then verify the values survive recovery.
  phase = "design-inputs";
  await page.goto(
    `${frontendOrigin}/projects/${encodeURIComponent(projectId)}?stage=define&window=concept`,
    { waitUntil: "networkidle" },
  );
  await page.getByLabel("Vision").fill("A cooperative sky-island adventure");
  await page
    .getByLabel("Main gameplay loop")
    .fill("Explore, collect, craft, defend");
  await page
    .getByLabel("Core mechanics (one per line)")
    .fill("glide\ncraft\nteam defense");
  await page
    .getByLabel("Intended player experience")
    .fill("Cooperative discovery and progression");
  await page
    .getByLabel("Important design constraints (one per line)")
    .fill("Mobile-first traversal");
  await page.getByRole("button", { name: "Save Game Concept" }).click();
  await page.getByText("Saved.", { exact: true }).waitFor();

  await page
    .getByRole("tab", { name: "Map & Environment" })
    .click();
  await page.getByLabel("World theme").fill("Sky archipelago");
  await page.getByLabel("Environment type").fill("Floating islands");
  await page
    .getByLabel("Map structure")
    .fill("Central hub with branching islands");
  await page
    .getByLabel("Main locations (one per line)")
    .fill("Cloud Harbor\nAncient Observatory");
  await page
    .getByLabel("Atmosphere and visual direction")
    .fill("Bright, mysterious, storm-lit");
  await page
    .getByLabel("Gameplay and environmental constraints (one per line)")
    .fill("Readable navigation on mobile");
  await page.getByRole("button", { name: "Save Map & Environment" }).click();
  await page.getByText("Saved.", { exact: true }).waitFor();

  const designBefore = await api(
    `/projects/${encodeURIComponent(projectId)}`,
  );
  if (
    designBefore.gameConcept?.vision !==
      "A cooperative sky-island adventure" ||
    designBefore.gameConcept?.coreMechanics?.join("|") !==
      "glide|craft|team defense" ||
    designBefore.mapEnvironment?.worldTheme !== "Sky archipelago" ||
    designBefore.mapEnvironment?.mainLocations?.join("|") !==
      "Cloud Harbor|Ancient Observatory"
  ) {
    throw new Error(
      `Workspace forms did not persist both design sections: ${JSON.stringify({
        gameConcept: designBefore.gameConcept,
        mapEnvironment: designBefore.mapEnvironment,
      })}`,
    );
  }

  await page.screenshot({
    path: `${artifactDir}/before-restart.png`,
    fullPage: true,
  });

  phase = "restart";
  restartBackend();
  await waitForHealth();

  phase = "recovery";
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: new RegExp(projectName) })
    .waitFor({ timeout: 30_000 });

  let historyAfter = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    historyAfter = await api(
      `/projects/${encodeURIComponent(projectId)}/history`,
    );
    if (historyAfter.length > 0) break;
    await page.waitForTimeout(500);
  }

  const matching = historyAfter.filter(
    (record) => record.pipelineId === executionId,
  );
  if (historyAfter.length !== 1 || matching.length !== 1) {
    throw new Error(
      `Restart created duplicate or changed lifecycle identity: total=${historyAfter.length}, matching=${matching.length}`,
    );
  }

  const execution = await api(
    `/projects/${encodeURIComponent(projectId)}/generation/${encodeURIComponent(executionId)}/status`,
  );
  if (execution.id !== executionId || execution.project_id !== projectId) {
    throw new Error(
      "Recovered execution identity does not match the pre-restart lifecycle",
    );
  }

  const designAfter = await api(
    `/projects/${encodeURIComponent(projectId)}`,
  );
  if (
    designAfter.gameConcept?.vision !==
      "A cooperative sky-island adventure" ||
    designAfter.gameConcept?.coreMechanics?.join("|") !==
      "glide|craft|team defense" ||
    designAfter.mapEnvironment?.worldTheme !== "Sky archipelago" ||
    designAfter.mapEnvironment?.mainLocations?.join("|") !==
      "Cloud Harbor|Ancient Observatory"
  ) {
    throw new Error(
      `Post-restart design inputs changed: ${JSON.stringify({
        gameConcept: designAfter.gameConcept,
        mapEnvironment: designAfter.mapEnvironment,
      })}`,
    );
  }

  // Confirm the recovered values are rendered back into both browser forms.
  await page.goto(
    `${frontendOrigin}/projects/${encodeURIComponent(projectId)}?stage=define&window=concept`,
    { waitUntil: "networkidle" },
  );
  if (
    (await page.getByLabel("Vision").inputValue()) !==
      "A cooperative sky-island adventure" ||
    (await page.getByLabel("Core mechanics (one per line)").inputValue()) !==
      "glide\ncraft\nteam defense"
  ) {
    throw new Error("Game Concept form did not restore its saved values");
  }

  await page
    .getByRole("tab", { name: "Map & Environment" })
    .click();
  if (
    (await page.getByLabel("World theme").inputValue()) !== "Sky archipelago" ||
    (await page.getByLabel("Main locations (one per line)").inputValue()) !==
      "Cloud Harbor\nAncient Observatory"
  ) {
    throw new Error("Map & Environment form did not restore its saved values");
  }

  const unexpectedDiagnostics = browserDiagnostics.filter(
    (diagnostic) => !isExpectedDiagnostic(diagnostic),
  );

  await page.screenshot({
    path: `${artifactDir}/after-restart.png`,
    fullPage: true,
  });
  await writeFile(
    `${artifactDir}/evidence.json`,
    JSON.stringify(
      {
        frontendOrigin,
        apiUrl,
        projectId,
        executionId,
        statusBefore: historyBefore[0].status,
        statusAfter: historyAfter[0].status,
        executionStatus: execution.status,
        historyCountBefore: historyBefore.length,
        historyCountAfter: historyAfter.length,
        browserDiagnostics,
        unexpectedDiagnostics,
      },
      null,
      2,
    ),
  );

  if (unexpectedDiagnostics.length > 0) {
    throw new Error(
      `Unexpected browser diagnostics: ${unexpectedDiagnostics
        .map(
          (diagnostic) =>
            `${diagnostic.source}/${diagnostic.phase}: ${diagnostic.message}`,
        )
        .join(" | ")}`,
    );
  }
} finally {
  await browser.close();
}
