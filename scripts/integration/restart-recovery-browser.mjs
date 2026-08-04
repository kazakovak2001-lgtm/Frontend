import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const frontendOrigin = process.env.INT1B_FRONTEND_ORIGIN ?? "http://127.0.0.1:4173";
const apiUrl = process.env.INT1B_API_URL ?? "http://127.0.0.1:5051/api";
const backendImage = process.env.INT1B_BACKEND_IMAGE ?? "roblox-ai-studio-backend:int-1b";
const databaseUrl = process.env.INT1B_DATABASE_URL;
const backendName = process.env.INT1B_BACKEND_CONTAINER ?? "roblox-ai-studio-backend-int-1b";
const artifactDir = process.env.INT1B_ARTIFACT_DIR ?? "artifacts/int-1b-restart";

if (!databaseUrl) throw new Error("INT1B_DATABASE_URL is required");

await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const browserErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `int1b-${suffix}@example.com`;
const password = "Integration1B!123";
const projectName = `Restart Recovery ${suffix}`;

async function api(path) {
  return page.evaluate(
    async ({ url }) => {
      const response = await fetch(url, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
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
  execFileSync("docker", ["rm", "--force", backendName], { stdio: "inherit" });
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

try {
  await page.goto(`${frontendOrigin}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill("Integration Recovery");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByText("I agree to the Terms of Service").click();
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);

  await page.goto(`${frontendOrigin}/projects/new`, { waitUntil: "networkidle" });
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Description").fill(
    "A deterministic integration fixture used to verify PostgreSQL-backed backend restart recovery.",
  );
  await page.getByRole("button", { name: "Generate game" }).click();
  await page.waitForURL(/\/projects\/[^/?]+/, { timeout: 30_000 });

  const projectId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  if (!projectId) throw new Error("Project id was not present in workspace URL");

  let historyBefore = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    historyBefore = await api(`/projects/${encodeURIComponent(projectId)}/history`);
    if (historyBefore.length > 0) break;
    await page.waitForTimeout(500);
  }
  if (historyBefore.length !== 1) {
    throw new Error(`Expected one generation record before restart, received ${historyBefore.length}`);
  }
  const executionId = historyBefore[0].pipelineId;
  if (!executionId) throw new Error("Generation history did not expose a pipeline id");

  await page.screenshot({ path: `${artifactDir}/before-restart.png`, fullPage: true });
  restartBackend();
  await waitForHealth();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: new RegExp(projectName) }).waitFor({ timeout: 30_000 });

  let historyAfter = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    historyAfter = await api(`/projects/${encodeURIComponent(projectId)}/history`);
    if (historyAfter.length > 0) break;
    await page.waitForTimeout(500);
  }

  const matching = historyAfter.filter((record) => record.pipelineId === executionId);
  if (historyAfter.length !== 1 || matching.length !== 1) {
    throw new Error(
      `Restart created duplicate or changed lifecycle identity: total=${historyAfter.length}, matching=${matching.length}`,
    );
  }

  const execution = await api(
    `/projects/${encodeURIComponent(projectId)}/generation/${encodeURIComponent(executionId)}/status`,
  );
  if (execution.id !== executionId || execution.project_id !== projectId) {
    throw new Error("Recovered execution identity does not match the pre-restart lifecycle");
  }

  await page.screenshot({ path: `${artifactDir}/after-restart.png`, fullPage: true });
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
        browserErrors,
      },
      null,
      2,
    ),
  );

  if (browserErrors.length > 0) {
    throw new Error(`Browser errors detected: ${browserErrors.join(" | ")}`);
  }
} finally {
  await browser.close();
}
