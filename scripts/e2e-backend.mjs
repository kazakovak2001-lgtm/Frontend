import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { io } from "socket.io-client";

const EXPECTED_CHECK_COUNT = 40;
const apiBase = (
  process.env.E2E_API_URL ?? "http://127.0.0.1:5000/api"
).replace(/\/$/, "");
const socketBase = process.env.E2E_SOCKET_URL ?? new URL(apiBase).origin;
const evidencePath = process.env.E2E_EVIDENCE_PATH;
const suiteStartedAt = new Date();
const cookies = new Map();
const completedChecks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contractMetadata() {
  return {
    contract: "INT-201",
    expectedCheckCount: EXPECTED_CHECK_COUNT,
    backendSha: process.env.E2E_BACKEND_SHA ?? null,
    frontendSha: process.env.E2E_FRONTEND_SHA ?? null,
    runtime: {
      contractMode: process.env.E2E_CONTRACT_MODE ?? "local",
      nodeEnv: process.env.E2E_BACKEND_NODE_ENV ?? null,
      storageProvider: process.env.E2E_STORAGE_PROVIDER ?? null,
      frontendOrigin: process.env.E2E_FRONTEND_ORIGIN ?? null,
      apiUrl: apiBase,
      socketUrl: socketBase,
      nodeVersion: process.version,
    },
    ci: {
      repository: process.env.GITHUB_REPOSITORY ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      workflow: process.env.GITHUB_WORKFLOW ?? null,
    },
  };
}

function assertProtectedProductionContract() {
  if (process.env.E2E_CONTRACT_MODE !== "production") return;

  for (const [name, value] of [
    ["E2E_BACKEND_SHA", process.env.E2E_BACKEND_SHA],
    ["E2E_FRONTEND_SHA", process.env.E2E_FRONTEND_SHA],
  ]) {
    assert(
      /^[0-9a-f]{40}$/i.test(value ?? ""),
      `${name} must identify an exact 40-character commit SHA`,
    );
  }
  assert(
    process.env.E2E_BACKEND_NODE_ENV === "production",
    "Protected contract requires E2E_BACKEND_NODE_ENV=production",
  );
  assert(
    Boolean(process.env.E2E_STORAGE_PROVIDER),
    "Protected contract requires an explicit E2E_STORAGE_PROVIDER",
  );
  assert(
    Boolean(process.env.E2E_FRONTEND_ORIGIN),
    "Protected contract requires an explicit E2E_FRONTEND_ORIGIN",
  );
  assert(
    Boolean(process.env.E2E_API_URL),
    "Protected contract requires an explicit E2E_API_URL",
  );
  assert(
    Boolean(process.env.E2E_SOCKET_URL),
    "Protected contract requires an explicit E2E_SOCKET_URL",
  );
  assert(
    Boolean(evidencePath),
    "Protected contract requires E2E_EVIDENCE_PATH",
  );
}

async function writeEvidence(status, error) {
  if (!evidencePath) return;

  const finishedAt = new Date();
  const evidence = {
    schemaVersion: 1,
    ...contractMetadata(),
    status,
    startedAt: suiteStartedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - suiteStartedAt.getTime(),
    completedCheckCount: completedChecks.length,
    checks: completedChecks,
    error:
      error === undefined
        ? null
        : {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          },
  };

  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function rememberCookies(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  for (const value of values) {
    const [pair, ...attributes] = value.split(";");
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    const content = pair.slice(separator + 1).trim();
    const expires = attributes.join(";").toLowerCase();
    if (!content || expires.includes("max-age=0")) cookies.delete(name);
    else cookies.set(name, content);
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

function realtimeConnectionOptions() {
  const realtimeHeaders = cookieHeader()
    ? { Cookie: cookieHeader() }
    : undefined;
  return {
    transports: ["polling", "websocket"],
    withCredentials: true,
    extraHeaders: realtimeHeaders,
    transportOptions: {
      polling: { extraHeaders: realtimeHeaders },
      websocket: { extraHeaders: realtimeHeaders },
    },
  };
}

async function request(path, options = {}, expectedStatus) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
      ...(options.headers ?? {}),
    },
  });
  rememberCookies(response);
  const payload = await response.json().catch(() => ({}));
  if (expectedStatus !== undefined) {
    assert(
      response.status === expectedStatus,
      `${options.method ?? "GET"} ${path}: expected ${expectedStatus}, received ${response.status}`,
    );
    return payload;
  }
  if (!response.ok || payload.success === false) {
    throw new Error(
      `${options.method ?? "GET"} ${path}: ${response.status} ${payload.error ?? payload.message ?? "request failed"}`,
    );
  }
  return payload.data ?? payload;
}

function json(method, body) {
  return { method, body: JSON.stringify(body) };
}

async function check(name, operation) {
  const startedAt = Date.now();
  const value = await operation();
  completedChecks.push({ name, durationMs: Date.now() - startedAt });
  console.log(`✓ ${name}`);
  return value;
}

function waitForSocket(socket, event, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Socket event ${event} timed out`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

async function waitForTerminalGeneration(projectId, executionId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const execution = await request(
      `/projects/${encodeURIComponent(projectId)}/generation/${encodeURIComponent(executionId)}/status`,
    );
    if (["completed", "failed", "cancelled"].includes(execution.status)) {
      return execution;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Generation ${executionId} did not reach a terminal state`);
}

async function waitForTerminalStatus(
  path,
  label,
  terminalStatuses = ["completed", "failed", "cancelled"],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await request(path);
    if (terminalStatuses.includes(state.status)) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not reach a terminal state`);
}

async function main() {
  assertProtectedProductionContract();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = `E2E-${suffix}-Secure!`;

  await check("health", async () => {
    const response = await fetch(`${new URL(apiBase).origin}/health`);
    const body = await response.json();
    assert(response.ok && body.status === "healthy", "Backend is not healthy");
  });

  const registration = await check("register and cookie session", () =>
    request(
      "/platform/auth/register",
      json("POST", {
        displayName: "E2E Developer",
        email,
        password,
      }),
    ),
  );
  const userId = registration.user.id;
  assert(userId, "Registration did not return a user id");
  assert(cookies.has("roblox_ai_token"), "Access cookie was not set");

  await check("restore authenticated user", async () => {
    const session = await request("/platform/auth/me");
    assert(session.user.id === userId, "Session user does not match");
  });

  await check("refresh authenticated session", async () => {
    await request("/platform/auth/refresh", { method: "POST" });
    const session = await request("/platform/auth/me");
    assert(session.user.id === userId, "Refreshed session user does not match");
  });

  await check("update profile", async () => {
    const user = await request(
      `/platform/users/${userId}`,
      json("PATCH", {
        displayName: "E2E Developer Updated",
        email,
      }),
    );
    assert(
      user.displayName === "E2E Developer Updated",
      "Profile update was not persisted",
    );
  });

  await check("load and save preferences", async () => {
    await request(`/platform/users/${userId}/preferences`);
    const saved = await request(
      `/platform/users/${userId}/preferences`,
      json("PUT", {
        appearance: "system",
        notifications: {
          product: false,
          generation: true,
          marketing: false,
        },
      }),
    );
    assert(saved.appearance === "system", "Preferences were not saved");
  });

  const project = await check("create project", async () => {
    const created = await request(
      "/projects",
      json("POST", {
        name: `E2E Workspace ${suffix}`,
        type: "Open World",
        genre: "Adventure",
        description: "End-to-end contract and realtime verification.",
        difficulty: "Medium",
        players: "1–10",
        targetAudience: "Everyone",
      }),
    );
    assert(created.id, "Project id is missing");
    assert(created.type === "Open World", "Game type contract is not aligned");
    return created;
  });

  await check("list and open project", async () => {
    const projects = await request("/projects");
    assert(
      projects.some((item) => item.id === project.id),
      "Created project is missing from list",
    );
    const opened = await request(`/projects/${project.id}`);
    assert(opened.id === project.id, "Project detail returned another project");
  });

  const userMessage = await check("create persistent chat conversation", () =>
    request(
      "/chat/message",
      json("POST", {
        projectId: project.id,
        role: "user",
        content: "Review the current game loop.",
      }),
    ),
  );

  const assistant = await check("AI chat", () =>
    request(
      "/ai/chat",
      json("POST", {
        messages: [{ role: "user", content: "Review the current game loop." }],
        gameContext: {
          projectId: project.id,
          name: project.name,
          genre: project.genre,
        },
      }),
    ),
  );
  assert(assistant.content, "AI chat returned no content");

  await check("persist and reload AI response", async () => {
    await request(
      "/chat/message",
      json("POST", {
        conversationId: userMessage.conversationId,
        role: "assistant",
        content: assistant.content,
      }),
    );
    const history = await request(`/chat/${project.id}/history`);
    assert(history.length === 1, "Conversation history is incomplete");
    const conversation = await request(
      `/chat/conversation/${userMessage.conversationId}`,
    );
    assert(conversation.messages.length === 2, "Messages were not persisted");
  });

  await check("system and agent modules", async () => {
    const [status, agents] = await Promise.all([
      request("/system/status"),
      request("/system/agents"),
    ]);
    assert(
      status && Array.isArray(agents),
      "System module contract is invalid",
    );
  });

  await check("analytics module", async () => {
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

  await check("knowledge module", async () => {
    const search = await request(
      "/knowledge/search?genre=Adventure&systems=Open%20World",
    );
    const recommendations = await request(
      "/knowledge/recommend?genre=Adventure&systems=Open%20World",
    );
    assert(
      Array.isArray(search) &&
        Array.isArray(recommendations.recommendedPatterns) &&
        Array.isArray(recommendations.similarProjects),
      "Knowledge module returned an invalid recommendation contract",
    );
  });

  const blueprint = {
    id: project.id,
    title: project.name,
    genre: "adventure",
    description: project.description,
    coreLoop: ["discover", "engage", "reward", "repeat"],
    mechanics: ["open world", "progression", "social interaction"],
    world: {
      mapType: "Open World",
      size: "medium",
      biomes: ["spawn", "main-area"],
      landmarks: [],
    },
    npcs: [
      {
        id: "npc-guide",
        name: "Guide",
        role: "tutorial",
        behavior: "greet-player",
      },
    ],
    economy: {
      currency: "coins",
      sources: ["quests", "exploration", "gameplay"],
      sinks: ["upgrades", "cosmetics", "unlocks"],
      balanceStrategy: "progressive-earning",
    },
    progression: {
      type: "medium",
      stages: ["beginner", "intermediate", "advanced", "mastery"],
      unlockMechanism: "level-thresholds",
      estimatedPlaytime: "10-50 hours",
    },
    createdAt: new Date().toISOString(),
  };
  const qualityInput = {
    projectId: project.id,
    scripts: [
      {
        name: "Main",
        type: "server",
        path: "ServerScriptService/Main.server.lua",
        content:
          "-- E2E validation fixture\nlocal Players = game:GetService('Players')\nreturn Players",
        dependencies: [],
      },
    ],
    assets: [
      {
        name: "Spawn",
        type: "model",
        targetService: "Workspace",
        placeholder: false,
      },
    ],
    dependencyGraph: {
      nodes: ["Main"],
      edges: [],
      circular: [],
    },
  };

  await check("simulation and economy modules", async () => {
    const [simulation, economy] = await Promise.all([
      request("/simulate/game", json("POST", { blueprint, ticks: 20 })),
      request("/economy/analyze", json("POST", { blueprint, ticks: 20 })),
    ]);
    assert(simulation && economy, "Simulation or economy result is missing");
  });

  await check("AI project controller", async () => {
    const [health, preCheck, architecture, duplicates] = await Promise.all([
      request("/controller/health"),
      request(
        "/controller/pre-check",
        json("POST", {
          intent: `Validate ${project.name}`,
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

  await check("concept, architect and domain modules", async () => {
    const [concept, architecture, genres, recommendations, benchmark] =
      await Promise.all([
        request(
          "/concept/generate",
          json("POST", {
            gameDescription: project.description,
            genre: "adventure",
            style: project.gameType,
            targetAudience: project.targetAudience,
          }),
        ),
        request(
          "/ai/game-architect/generate-design",
          json("POST", {
            description: project.description,
            genre: "adventure",
            targetAudience: project.targetAudience,
          }),
        ),
        request("/domain/genres"),
        request("/domain/recommendations?genre=adventure"),
        request(
          "/domain/analyze",
          json("POST", {
            genre: "adventure",
            systems: ["exploration", "progression", "economy"],
            scriptCount: 1,
            assetCount: 1,
            hasMultiplayer: true,
          }),
        ),
      ]);
    assert(
      concept.conceptId &&
        architecture.analysis &&
        Array.isArray(genres) &&
        recommendations &&
        benchmark.overallScore !== undefined,
      "Design intelligence contracts are incomplete",
    );
  });

  await check("planning and versioned API contracts", async () => {
    const plan = await request(
      "/plan/create",
      json("POST", {
        intent: `Build ${project.name}`,
        projectId: project.id,
        constraints: ["E2E deterministic"],
      }),
    );
    const [execution, dag, apiStatus] = await Promise.all([
      request(
        "/plan/execute",
        json("POST", {
          planId: plan.planId,
          options: { stopOnFailure: false, maxRetries: 1 },
        }),
      ),
      request(
        "/v2/plan/dag",
        json("POST", {
          intent: `Inspect ${project.name}`,
          projectId: project.id,
        }),
      ),
      request("/v2/status"),
    ]);
    assert(
      execution.planId === plan.planId &&
        dag.dag?.nodes?.length > 0 &&
        apiStatus.version,
      "Planning or versioned API contract is incomplete",
    );
  });

  await check("generation core and stable compile", async () => {
    const generated = await request(
      "/generate/game",
      json("POST", {
        intent: `Generate ${project.name}`,
        projectId: project.id,
      }),
    );
    const compiled = await request(
      "/v1/compile",
      json("POST", {
        intent: `Compile ${project.name}`,
        projectId: project.id,
      }),
      200,
    );
    assert(
      generated.blueprint &&
        (compiled.success === true ||
          compiled.error?.code === "VALIDATION_GATE_FAILED"),
      "Generation or stable compile contract is incomplete",
    );
  });

  await check("Lua and asset assembly", async () => {
    const assembled = await request(
      "/lua/assemble-experience",
      json("POST", {
        projectId: project.id,
        gameName: project.name,
        genre: "adventure",
      }),
    );
    assert(
      assembled.generationResult?.totalScripts > 0,
      "Lua assembly did not return scripts",
    );
  });

  await check("world and lifecycle modules", async () => {
    const world = await request(
      "/world/simulate",
      json("POST", { blueprint, ticks: 20 }),
    );
    const lifecycle = await request(
      "/lifecycle/start",
      json("POST", { gameId: project.id }),
    );
    const cycle = await request(
      "/lifecycle/tick",
      json("POST", {
        gameId: project.id,
        blueprint,
        simulationData: { engagementScore: 75 },
        economyData: { healthScore: 80 },
        worldData: { stability: 85, anomalyRate: 5 },
      }),
    );
    assert(
      world.ticks === 20 && lifecycle.gameId === project.id && cycle.health,
      "World or lifecycle contract is incomplete",
    );
  });

  await check("memory and evaluation modules", async () => {
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

  await check("playtest and repair modules", async () => {
    const playtest = await request("/playtest/run", json("POST", qualityInput));
    const repair = await request(
      "/repair/run",
      json("POST", {
        ...qualityInput,
        config: { maxIterations: 2 },
      }),
    );
    assert(
      playtest.overallScore !== undefined && repair.projectId === project.id,
      "Playtest or repair contract is incomplete",
    );
  });

  await check("collaboration and autonomous modules", async () => {
    const [collaboration, autonomous] = await Promise.all([
      request(
        "/agents/run",
        json("POST", {
          projectId: project.id,
          systems: ["exploration", "progression", "economy"],
        }),
      ),
      request(
        "/autonomous/run",
        json("POST", {
          prompt: `Create and validate ${project.name}`,
          projectId: project.id,
          goals: ["playable core loop", "validated architecture"],
        }),
      ),
    ]);
    const terminal = await waitForTerminalStatus(
      `/autonomous/status/${autonomous.sessionId}`,
      `Autonomous session ${autonomous.sessionId}`,
      ["preview_completed", "failed", "cancelled"],
    );
    const autonomousPhases = new Map(
      terminal.phases.map((phase) => [phase.phase, phase]),
    );
    const luaPhase = autonomousPhases.get("lua_generation");
    const playtestPhase = autonomousPhases.get("playtest");
    const repairPhase = autonomousPhases.get("repair");
    const studioSyncPhase = autonomousPhases.get("studio_sync");
    assert(
      Array.isArray(collaboration.tasks) &&
        autonomous.sessionId &&
        autonomous.productionCompleted === false &&
        terminal.status === "preview_completed" &&
        terminal.executionMode === "bounded" &&
        terminal.resultAuthority === "preview-only" &&
        Number.isFinite(terminal.qualityScore) &&
        terminal.qualityScore >= 0 &&
        terminal.qualityScore <= 100 &&
        terminal.cost?.totalCost === 0 &&
        terminal.cost?.source === "measured" &&
        luaPhase?.status === "completed" &&
        luaPhase?.evidence === "verified" &&
        luaPhase?.capability === "available" &&
        playtestPhase?.status === "completed" &&
        playtestPhase?.evidence === "heuristic" &&
        playtestPhase?.capability === "degraded" &&
        playtestPhase?.output?.runtimeExecuted === false &&
        repairPhase?.status === "skipped" &&
        repairPhase?.capability === "unavailable" &&
        studioSyncPhase?.status === "skipped" &&
        studioSyncPhase?.capability === "unavailable",
      "Collaboration or autonomous contract is incomplete",
    );
  });

  await check("distributed runtime and diagnostics", async () => {
    const [cluster, queue, workers, submitted, traces] = await Promise.all([
      request("/distributed/cluster"),
      request("/distributed/queue"),
      request("/distributed/workers"),
      request(
        "/distributed/submit",
        json("POST", {
          intent: `Validate distributed execution for ${project.name}`,
          projectId: project.id,
          priority: "normal",
        }),
      ),
      request("/debug/executions"),
    ]);
    const terminalJob = await waitForTerminalStatus(
      `/distributed/job/${submitted.jobId}`,
      `Distributed job ${submitted.jobId}`,
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

  await check("platform registry and version snapshots", async () => {
    const registry = await request("/platform/registry/agents");
    const version = await request(
      `/platform/versions/${project.id}`,
      json("POST", {
        label: "e2e",
        qualityScore: 100,
        snapshot: project,
      }),
    );
    const versions = await request(`/platform/versions/${project.id}`);
    assert(
      Array.isArray(registry) &&
        version.projectId === project.id &&
        versions.some((item) => item.id === version.id),
      "Registry or versioning contract is incomplete",
    );
  });

  await check("cross-user project and realtime isolation", async () => {
    const ownerCookies = new Map(cookies);
    await request(
      "/platform/auth/register",
      json("POST", {
        displayName: "E2E Intruder",
        email: `intruder-${suffix}@example.test`,
        password: `Intruder-${suffix}-Secure!`,
      }),
    );

    const [detail, history, chat, exported, versions, injected] =
      await Promise.all([
        request(`/projects/${project.id}`, {}, 403),
        request(`/projects/${project.id}/history`, {}, 403),
        request(`/chat/${project.id}/history`, {}, 403),
        request(`/projects/${project.id}/export`, {}, 403),
        request(`/platform/versions/${project.id}`, {}, 403),
        request(
          "/autonomous/run",
          json("POST", {
            prompt: `Attempt access to ${project.name}`,
            projectId: project.id,
          }),
          403,
        ),
      ]);
    assert(
      [detail, history, chat, exported, versions, injected].every(
        (payload) => payload.success === false,
      ),
      "A project-scoped REST contract leaked across users",
    );

    const intruderSocket = io(socketBase, realtimeConnectionOptions());
    if (!intruderSocket.connected) {
      await waitForSocket(intruderSocket, "connect");
    }
    const denied = waitForSocket(intruderSocket, "project:error");
    intruderSocket.emit("project:join", { projectId: project.id });
    const denial = await denied;
    intruderSocket.disconnect();
    assert(
      denial.projectId === project.id,
      "Realtime project room was not isolated",
    );

    cookies.clear();
    for (const [name, value] of ownerCookies) cookies.set(name, value);
    const ownerSession = await request("/platform/auth/me");
    assert(
      ownerSession.user.id === userId,
      "Owner session was not restored after isolation test",
    );
  });

  await check("Studio status and guarded sync", async () => {
    const status = await request(`/projects/${project.id}/studio/status`);
    assert(
      status.status === "disconnected",
      "Studio status should report disconnected without a bridge",
    );
    assert(
      status.artifactVerified === false && status.verificationStatus === "idle",
      "Disconnected Studio status must remain explicitly unverified",
    );
    const sync = await request(
      `/projects/${project.id}/studio/sync`,
      json("POST", {}),
      404,
    );
    assert(sync.success === false, "Disconnected Studio sync must be rejected");
  });

  const socket = io(socketBase, realtimeConnectionOptions());
  socket.on("connect_error", (error) => {
    console.error(`Socket.IO connect_error: ${error.message}`);
  });
  const realtimeEvents = [];
  socket.onAny((event, payload) => {
    if (payload?.projectId === project.id) {
      realtimeEvents.push({ event, payload });
    }
  });

  await check("join realtime project room", async () => {
    if (!socket.connected) await waitForSocket(socket, "connect");
    const joined = waitForSocket(socket, "project:joined");
    socket.emit("project:join", { projectId: project.id });
    const payload = await joined;
    assert(payload.projectId === project.id, "Joined the wrong project room");
  });

  const generation = await check("start generation", () =>
    request(`/projects/${project.id}/generate`, json("POST", { userId })),
  );
  const terminal = await check("poll generation to completion", () =>
    waitForTerminalGeneration(project.id, generation.executionId),
  );

  await check("receive scoped realtime pipeline", async () => {
    const deadline = Date.now() + 5_000;
    while (
      !realtimeEvents.some(({ event }) =>
        ["pipeline.completed", "pipeline.failed"].includes(event),
      ) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const started = realtimeEvents.find(
      ({ event }) => event === "pipeline.started",
    );
    const finished = realtimeEvents.find(({ event }) =>
      ["pipeline.completed", "pipeline.failed"].includes(event),
    );
    assert(started, "pipeline.started was not delivered over Socket.IO");
    assert(
      finished,
      "Terminal pipeline event was not delivered over Socket.IO",
    );
    assert(
      started.payload.pipelineId === generation.executionId,
      "REST and realtime execution IDs differ",
    );
    assert(
      realtimeEvents.some(({ event }) => event.startsWith("step.")),
      "No realtime step events were delivered",
    );
  });
  socket.disconnect();

  await check("generation history and project lifecycle", async () => {
    const history = await request(`/projects/${project.id}/history`);
    const record = history.find(
      (item) => item.pipelineId === generation.executionId,
    );
    assert(record, "Generation history record is missing");
    assert(
      ["completed", "failed"].includes(record.status),
      "Generation history did not reach a terminal state",
    );
    const updatedProject = await request(`/projects/${project.id}`);
    const expectedStatus = terminal.status === "completed" ? "ready" : "draft";
    assert(
      updatedProject.status === expectedStatus,
      `Project lifecycle expected ${expectedStatus}, received ${updatedProject.status}`,
    );
  });

  await check("manifest export", async () => {
    const manifest = await request(`/projects/${project.id}/export`);
    assert(
      manifest.format === "roblox-ai-studio-project-manifest",
      "Export manifest format is invalid",
    );
  });

  await check("project settings update", async () => {
    const updated = await request(
      `/projects/${project.id}`,
      json("PUT", {
        name: `${project.name} Updated`,
        description: "Updated through the settings flow.",
        coverUrl: "https://example.test/cover.png",
      }),
    );
    assert(updated.name.endsWith("Updated"), "Project settings were not saved");
    assert(updated.coverUrl, "Cover update was not saved");
  });

  await check("forgot password request", async () => {
    const accepted = await request(
      "/platform/auth/forgot-password",
      json("POST", { email }),
    );
    assert(accepted.accepted === true, "Password reset was not accepted");
  });

  await check("clear conversation", async () => {
    await request(`/chat/conversation/${userMessage.conversationId}`, {
      method: "DELETE",
    });
    const history = await request(`/chat/${project.id}/history`);
    assert(history.length === 0, "Conversation was not deleted");
  });

  await check("delete project", async () => {
    await request(`/projects/${project.id}`, { method: "DELETE" });
    const projects = await request("/projects");
    assert(
      !projects.some((item) => item.id === project.id),
      "Project remained after deletion",
    );
  });

  await check("logout clears session", async () => {
    await request("/platform/auth/logout", { method: "POST" });
    await request("/platform/auth/me", {}, 401);
  });

  await check("login restores session", async () => {
    const session = await request(
      "/platform/auth/login",
      json("POST", { email, password }),
    );
    assert(session.user.id === userId, "Login returned another user");
    const current = await request("/platform/auth/me");
    assert(current.user.id === userId, "Login cookie session was not restored");
    await request("/platform/auth/logout", { method: "POST" });
  });

  assert(
    completedChecks.length === EXPECTED_CHECK_COUNT,
    `Expected exactly ${EXPECTED_CHECK_COUNT} contract checks, completed ${completedChecks.length}`,
  );

  console.log(
    `\n${completedChecks.length} E2E checks passed in ${completedChecks.reduce(
      (sum, item) => sum + item.durationMs,
      0,
    )}ms (${terminal.status} pipeline).`,
  );
}

async function run() {
  try {
    await main();
    await writeEvidence("passed");
  } catch (error) {
    try {
      await writeEvidence("failed", error);
    } catch (evidenceError) {
      console.error(
        `\nFailed to write E2E evidence: ${evidenceError.stack ?? evidenceError.message ?? evidenceError}`,
      );
    }
    throw error;
  }
}

run().catch((error) => {
  console.error(`\nE2E failed: ${error.stack ?? error.message ?? error}`);
  process.exitCode = 1;
});
