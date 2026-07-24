import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const frontendUrl = process.env.QA_FRONTEND_URL ?? "http://127.0.0.1:4173";
const chromePath =
  process.env.CHROME_PATH ??
  process.env.CHROME_BIN ??
  "/usr/bin/google-chrome";
const artifactsDir = path.resolve(
  process.env.QA_ARTIFACTS_DIR ?? "artifacts/workspace-responsive",
);
const debugPort = Number(process.env.QA_CHROME_DEBUG_PORT ?? 9222);
const userDataDir = path.join("/tmp", `workspace-responsive-chrome-${process.pid}`);

const stageExpectations = {
  define: {
    heading: "Define the project",
    marker: "Concept, Architect & Domain",
  },
  generate: {
    heading: "Generate the experience",
    marker: "Planning & Autonomous Generation",
  },
  validate: {
    heading: "Validate and improve",
    marker: "Playtest, Repair & Evaluation",
  },
  integrate: {
    heading: "Integrate and export",
    marker: "Project Versioning",
  },
  operate: {
    heading: "Operate the project",
    marker: "Distributed Runtime & Diagnostics",
  },
};

const responsiveCases = [
  { name: "desktop-1440-define", width: 1440, height: 1000, stage: "define" },
  { name: "tablet-1024-validate", width: 1024, height: 900, stage: "validate" },
  { name: "mobile-390-integrate", width: 390, height: 844, stage: "integrate" },
];

await mkdir(artifactsDir, { recursive: true });
await rm(userDataDir, { recursive: true, force: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let chromeOutput = "";
chrome.stdout.on("data", (chunk) => (chromeOutput += chunk.toString()));
chrome.stderr.on("data", (chunk) => (chromeOutput += chunk.toString()));

try {
  const target = await waitForTarget(debugPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const report = { generatedAt: new Date().toISOString(), cases: [], stages: [] };

  for (const testCase of responsiveCases) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: testCase.width,
      height: testCase.height,
      deviceScaleFactor: 1,
      mobile: testCase.width < 600,
      screenWidth: testCase.width,
      screenHeight: testCase.height,
    });

    const probe = await openWorkspace(cdp, testCase.stage);
    assertResponsiveLayout(testCase, probe);
    await captureScreenshot(cdp, `${testCase.name}.png`);
    report.cases.push({ ...testCase, probe });
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1024,
    screenHeight: 900,
  });

  for (const [stage, expectation] of Object.entries(stageExpectations)) {
    const probe = await openWorkspace(cdp, stage, [
      expectation.heading,
      expectation.marker,
    ]);
    assert(
      probe.activeStage.toLowerCase().includes(stage),
      `${stage}: workflow rail did not mark the requested stage active`,
    );
    assert(
      probe.bodyText.includes(expectation.heading),
      `${stage}: heading “${expectation.heading}” is missing`,
    );
    assert(
      probe.bodyText.includes(expectation.marker),
      `${stage}: scoped tool “${expectation.marker}” is missing`,
    );
    assert(
      probe.scrollWidth <= probe.viewportWidth + 1,
      `${stage}: horizontal overflow ${probe.scrollWidth}px > ${probe.viewportWidth}px`,
    );
    report.stages.push({ stage, heading: expectation.heading, marker: expectation.marker });
  }

  await writeFile(
    path.join(artifactsDir, "workspace-responsive-report.json"),
    JSON.stringify(report, null, 2),
  );
  await cdp.close();
  console.log(
    `[workspace-responsive] ${responsiveCases.length} viewports and ${Object.keys(stageExpectations).length} stages passed`,
  );
} catch (error) {
  await writeFile(path.join(artifactsDir, "chrome.log"), chromeOutput).catch(() => {});
  throw error;
} finally {
  chrome.kill("SIGTERM");
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

async function openWorkspace(cdp, stage, extraMarkers = []) {
  const url = `${frontendUrl}/projects/qa-project?stage=${encodeURIComponent(stage)}`;
  await cdp.send("Page.navigate", { url });

  return poll(async () => {
    const probe = await evaluate(cdp, workspaceProbeExpression);
    const ready =
      probe.projectVisible &&
      probe.workflowStageCount === 5 &&
      probe.contextVisible &&
      extraMarkers.every((marker) => probe.bodyText.includes(marker));
    return ready ? probe : undefined;
  }, 25_000, `${stage} Workspace did not become ready`);
}

function assertResponsiveLayout(testCase, probe) {
  assert(probe.projectVisible, `${testCase.name}: project content is missing`);
  assert(
    probe.workflowStageCount === 5,
    `${testCase.name}: expected 5 workflow stages, received ${probe.workflowStageCount}`,
  );
  assert(probe.contextVisible, `${testCase.name}: context rail is missing`);
  assert(
    probe.scrollWidth <= probe.viewportWidth + 1,
    `${testCase.name}: horizontal overflow ${probe.scrollWidth}px > ${probe.viewportWidth}px`,
  );

  const topSpread = Math.max(...probe.stageButtonTops) - Math.min(...probe.stageButtonTops);
  if (testCase.width >= 768) {
    assert(
      topSpread <= 4,
      `${testCase.name}: workflow stages should share one row above the mobile breakpoint`,
    );
  } else {
    assert(
      new Set(probe.stageButtonTops).size === 5,
      `${testCase.name}: workflow stages should stack vertically on mobile`,
    );
  }

  if (testCase.width >= 1280) {
    assert(
      probe.contextRect.left > probe.stageRect.left + 80,
      `${testCase.name}: context rail should be beside the stage canvas on desktop`,
    );
    assert(
      Math.abs(probe.contextRect.top - probe.stageRect.top) <= 8,
      `${testCase.name}: context rail and stage canvas should align at the top`,
    );
  } else {
    assert(
      probe.contextRect.top >= probe.stageRect.bottom,
      `${testCase.name}: context rail should move below the stage canvas`,
    );
  }
}

async function captureScreenshot(cdp, filename) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const contentSize = metrics.cssContentSize ?? metrics.contentSize;
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(contentSize.width),
      height: Math.min(Math.ceil(contentSize.height), 8_000),
      scale: 1,
    },
  });
  await writeFile(path.join(artifactsDir, filename), Buffer.from(result.data, "base64"));
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? "Browser evaluation failed");
  }
  return response.result.value;
}

const workspaceProbeExpression = `(() => {
  const workflow = document.querySelector('nav[aria-label="Project workflow"]');
  const context = document.querySelector('aside[aria-label="Workspace context"]');
  const stage = document.querySelector('section[aria-labelledby$="-stage-title"]');
  const stageButtons = workflow ? [...workflow.querySelectorAll('button')] : [];
  const bodyText = document.body?.innerText ?? '';
  const rect = (element) => {
    if (!element) return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
    const value = element.getBoundingClientRect();
    return {
      top: Math.round(value.top),
      right: Math.round(value.right),
      bottom: Math.round(value.bottom),
      left: Math.round(value.left),
      width: Math.round(value.width),
      height: Math.round(value.height),
    };
  };
  return {
    url: location.href,
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    projectVisible: bodyText.includes('Skyline Tycoon'),
    workflowStageCount: stageButtons.length,
    stageButtonTops: stageButtons.map((button) => Math.round(button.getBoundingClientRect().top)),
    activeStage: workflow?.querySelector('[aria-current="step"]')?.textContent?.trim() ?? '',
    contextVisible: Boolean(context),
    stageRect: rect(stage),
    contextRect: rect(context),
    bodyText: bodyText.slice(0, 20_000),
  };
})()`;

async function waitForTarget(port) {
  return poll(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) return undefined;
      const targets = await response.json();
      return targets.find((target) => target.type === "page");
    } catch {
      return undefined;
    }
  }, 20_000, "Chrome DevTools endpoint did not start");
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP WebSocket connection timed out")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("CDP WebSocket connection failed"));
    });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result ?? {});
  });

  socket.addEventListener("close", () => {
    for (const { reject } of pending.values()) {
      reject(new Error("CDP WebSocket closed"));
    }
    pending.clear();
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    async close() {
      socket.close();
    },
  };
}

async function poll(operation, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value !== undefined) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(lastError ? `${message}: ${lastError.message}` : message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
