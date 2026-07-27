import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import worker from "../../.output/server/index.mjs";
import {
  closeServer,
  createFrontendServer,
  listenServer,
} from "../runtime/frontend-node-server.mjs";

const FRONTEND_PORT = 4173;
const BACKEND_PORT = 5000;
const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
const PUBLIC_ROOT = path.resolve(".output/public");
const ARTIFACT_DIR = "artifacts/workspace-responsive";
const PROJECT_ID = "qa-project";
const backendRequests = [];
const now = new Date("2026-07-24T15:00:00.000Z").toISOString();

const project = {
  id: PROJECT_ID,
  ownerId: "qa-owner",
  name: "QA Adventure Studio",
  description:
    "A durable Roblox adventure used to verify the responsive WORKSPACE-1 layout.",
  gameType: "Adventure",
  type: "Adventure",
  genre: "Adventure",
  difficulty: "Medium",
  players: "1–10",
  targetAudience: "Everyone",
  status: "ready",
  qualityScore: 92,
  progress: 100,
  createdAt: Date.parse("2026-07-23T10:00:00.000Z"),
  updatedAt: Date.parse(now),
};

const execution = {
  id: "execution-qa-complete",
  blueprint_id: "blueprint-qa",
  project_id: PROJECT_ID,
  status: "completed",
  started_at: "2026-07-24T14:54:00.000Z",
  completed_at: "2026-07-24T14:59:30.000Z",
  total_duration_ms: 330000,
  pipeline_steps: [
    { agent: "game_designer", status: "completed", duration_ms: 60000 },
    { agent: "roblox_architect", status: "completed", duration_ms: 120000 },
    { agent: "lua_generator", status: "completed", duration_ms: 150000 },
  ],
};

const manifest = {
  format: "roblox-ai-studio-project",
  version: "1.0.0",
  exportedAt: now,
  project,
  blueprint: {
    id: "blueprint-qa",
    project_id: PROJECT_ID,
    name: project.name,
    description: project.description,
    status: "ready_for_export",
    version: 3,
    created_at: "2026-07-23T10:05:00.000Z",
    updated_at: now,
  },
  executions: [execution],
};

const generationHistory = [
  {
    id: execution.id,
    projectId: PROJECT_ID,
    pipelineId: execution.id,
    status: "completed",
    startedAt: Date.parse(execution.started_at),
    finishedAt: Date.parse(execution.completed_at),
    duration: execution.total_duration_ms,
    stagesCompleted: 3,
    stagesTotal: 3,
    failures: 0,
  },
];

const agents = [
  {
    id: "game_designer",
    name: "Game Designer",
    role: "game_designer",
    description: "Defines the core loop and progression model.",
    status: "idle",
    progress: 100,
  },
  {
    id: "roblox_architect",
    name: "Roblox Architect",
    role: "roblox_architect",
    description: "Designs the client/server Roblox architecture.",
    status: "idle",
    progress: 100,
  },
  {
    id: "lua_generator",
    name: "Lua Generator",
    role: "lua_generator",
    description: "Generates typed Roblox Lua modules.",
    status: "idle",
    progress: 100,
  },
];

const cases = [
  {
    name: "desktop-define",
    width: 1440,
    height: 1000,
    stage: "define",
    stageHeading: "Define the project",
    expectedToolHeading: "Definition intelligence",
    workflowRows: 1,
    contextPlacement: "side",
  },
  {
    name: "tablet-validate",
    width: 1024,
    height: 900,
    stage: "validate",
    stageHeading: "Validate and improve",
    expectedToolHeading: "AI Project Controller",
    workflowRows: 1,
    contextPlacement: "below",
  },
  {
    name: "mobile-integrate",
    width: 390,
    height: 844,
    stage: "integrate",
    stageHeading: "Integrate and export",
    expectedToolHeading: "Project Versioning",
    workflowRows: 5,
    contextPlacement: "below",
  },
];

await mkdir(ARTIFACT_DIR, { recursive: true });
const backendServer = await listenServer(createMockBackend(), {
  port: BACKEND_PORT,
  host: "127.0.0.1",
});
const frontendServer = await listenServer(
  createFrontendServer({
    worker,
    origin: FRONTEND_ORIGIN,
    publicRoot: PUBLIC_ROOT,
    cacheControl: "no-store",
  }),
  { port: FRONTEND_PORT, host: "127.0.0.1" },
);
const browser = await chromium.launch({ headless: true });
const results = [];
let failure;

try {
  for (const testCase of cases) {
    results.push(await inspectViewport(browser, testCase));
  }
  assert.ok(
    backendRequests.some(({ path }) => path === "/api/platform/auth/me"),
    "responsive QA did not reach the authentication fixture",
  );
  assert.ok(
    backendRequests.some(
      ({ path }) => path === `/api/projects/${PROJECT_ID}/export`,
    ),
    "responsive QA did not load the Workspace read model",
  );
} catch (error) {
  failure = error;
} finally {
  await writeFile(
    `${ARTIFACT_DIR}/metrics.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        projectId: PROJECT_ID,
        backendRequests,
        results,
        failure: serializeError(failure),
      },
      null,
      2,
    ),
  );
  await browser.close();
  await closeServer(frontendServer);
  await closeServer(backendServer);
}

if (failure) throw failure;
console.log(JSON.stringify(results, null, 2));

async function inspectViewport(browserInstance, testCase) {
  const context = await browserInstance.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let responseStatus;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const navigation = await page.goto(
      `${FRONTEND_ORIGIN}/projects/${PROJECT_ID}?stage=${testCase.stage}`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    responseStatus = navigation?.status();
    await page
      .getByRole("heading", { name: project.name })
      .waitFor({ timeout: 45_000 });
    await page.getByRole("heading", { name: testCase.stageHeading }).waitFor();
    await page
      .getByText(testCase.expectedToolHeading, { exact: true })
      .waitFor();
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important}",
    });

    const metrics = await page.evaluate(() => {
      const workflow = document.querySelector(
        'nav[aria-label="Project workflow"]',
      );
      const contextRail = document.querySelector(
        'aside[aria-label="Workspace context"]',
      );
      const stageCanvas = document.querySelector(
        'section[aria-labelledby$="-stage-title"]',
      );
      if (!workflow || !contextRail || !stageCanvas) {
        throw new Error(
          "Workspace workflow, stage canvas, or context rail is missing",
        );
      }

      const buttons = [...workflow.querySelectorAll("button")];
      const buttonRects = buttons.map((button) =>
        button.getBoundingClientRect(),
      );
      const rowPositions = [];
      for (const rect of buttonRects) {
        if (!rowPositions.some((value) => Math.abs(value - rect.top) < 3)) {
          rowPositions.push(rect.top);
        }
      }
      const canvasRect = stageCanvas.getBoundingClientRect();
      const railRect = contextRail.getBoundingClientRect();
      const workflowRect = workflow.getBoundingClientRect();

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        scrollY: window.scrollY,
        horizontalOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 1 ||
          document.body.scrollWidth > window.innerWidth + 1,
        workflowButtonCount: buttons.length,
        workflowRows: rowPositions.length,
        workflowWithinViewport:
          workflowRect.left >= -1 &&
          workflowRect.right <= window.innerWidth + 1,
        allWorkflowButtonsVisible: buttonRects.every(
          (rect) =>
            rect.width > 0 &&
            rect.left >= -1 &&
            rect.right <= window.innerWidth + 1,
        ),
        activeStage:
          workflow
            .querySelector('[aria-current="step"]')
            ?.textContent?.trim() ?? "",
        canvas: toRect(canvasRect),
        contextRail: toRect(railRect),
      };

      function toRect(value) {
        return {
          left: Math.round(value.left),
          top: Math.round(value.top),
          right: Math.round(value.right),
          bottom: Math.round(value.bottom),
          width: Math.round(value.width),
          height: Math.round(value.height),
        };
      }
    });

    assert.equal(responseStatus, 200, `${testCase.name}: document response`);
    assert.ok(
      metrics.scrollY <= 4,
      `${testCase.name}: unexpected page jump (${metrics.scrollY}px)`,
    );
    assert.equal(
      metrics.horizontalOverflow,
      false,
      `${testCase.name}: horizontal overflow`,
    );
    assert.equal(
      metrics.workflowButtonCount,
      5,
      `${testCase.name}: workflow stage count`,
    );
    assert.equal(
      metrics.workflowRows,
      testCase.workflowRows,
      `${testCase.name}: workflow rows`,
    );
    assert.equal(
      metrics.workflowWithinViewport,
      true,
      `${testCase.name}: workflow viewport`,
    );
    assert.equal(
      metrics.allWorkflowButtonsVisible,
      true,
      `${testCase.name}: workflow buttons clipped`,
    );
    assert.match(
      metrics.activeStage,
      new RegExp(testCase.stage, "i"),
      `${testCase.name}: active workflow stage`,
    );

    if (testCase.contextPlacement === "side") {
      assert.ok(
        metrics.contextRail.left >= metrics.canvas.right - 2,
        `${testCase.name}: context rail is not beside the stage canvas`,
      );
      assert.ok(
        Math.abs(metrics.contextRail.top - metrics.canvas.top) < 16,
        `${testCase.name}: context rail top is misaligned`,
      );
    } else {
      assert.ok(
        metrics.contextRail.top >= metrics.canvas.bottom - 2,
        `${testCase.name}: context rail is not below the stage canvas`,
      );
    }
    assert.deepEqual(pageErrors, [], `${testCase.name}: page errors`);

    await page.screenshot({
      path: `${ARTIFACT_DIR}/${testCase.name}.png`,
      fullPage: true,
    });
    return {
      ...testCase,
      responseStatus,
      finalUrl: page.url(),
      ...metrics,
      consoleErrors,
      pageErrors,
    };
  } catch (error) {
    await Promise.allSettled([
      page.screenshot({
        path: `${ARTIFACT_DIR}/${testCase.name}-failure.png`,
        fullPage: true,
      }),
      page
        .content()
        .then((html) =>
          writeFile(`${ARTIFACT_DIR}/${testCase.name}-failure.html`, html),
        ),
      writeFile(
        `${ARTIFACT_DIR}/${testCase.name}-failure.json`,
        JSON.stringify(
          {
            responseStatus,
            finalUrl: page.url(),
            consoleErrors,
            pageErrors,
            error: serializeError(error),
          },
          null,
          2,
        ),
      ),
    ]);
    throw error;
  } finally {
    await context.close();
  }
}

function createMockBackend() {
  return createServer((request, response) => {
    const origin = request.headers.origin ?? FRONTEND_ORIGIN;
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader(
      "access-control-allow-headers",
      "content-type, authorization",
    );
    response.setHeader(
      "access-control-allow-methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const requestPath = new URL(
      request.url ?? "/",
      `http://localhost:${BACKEND_PORT}`,
    ).pathname;
    backendRequests.push({ method: request.method, path: requestPath });

    let data;
    if (requestPath === "/api/platform/auth/me") {
      data = {
        user: {
          id: "qa-owner",
          displayName: "QA Developer",
          email: "qa@example.com",
          plan: "pro",
        },
      };
    } else if (requestPath === "/api/projects") {
      data = [project];
    } else if (requestPath === `/api/projects/${PROJECT_ID}`) {
      data = project;
    } else if (requestPath === `/api/projects/${PROJECT_ID}/export`) {
      data = manifest;
    } else if (requestPath === `/api/projects/${PROJECT_ID}/history`) {
      data = generationHistory;
    } else if (requestPath === `/api/chat/${PROJECT_ID}/history`) {
      data = [];
    } else if (requestPath === `/api/projects/${PROJECT_ID}/studio/status`) {
      data = {
        status: "connected",
        studioId: "studio-qa",
        lastSyncAt: now,
        bridgeVersion: "1.0.0",
        message: "Roblox Studio is connected to the QA project.",
        pendingChanges: 0,
      };
    } else if (requestPath === "/api/system/agents") {
      data = agents;
    } else if (requestPath === "/api/system/status") {
      data = { status: "healthy", connected: true, version: "1.0.0" };
    } else if (requestPath.startsWith("/api/analytics/")) {
      data = { status: "healthy", score: 92, recommendations: [] };
    } else if (requestPath.startsWith("/api/knowledge/")) {
      data = [];
    } else if (request.method === "GET") {
      data = {};
    } else {
      data = { status: "completed", success: true };
    }

    response.statusCode = 200;
    response.end(JSON.stringify({ success: true, data }));
  });
}

function serializeError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;
}
