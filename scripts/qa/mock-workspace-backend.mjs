import http from "node:http";

const port = Number(process.env.QA_BACKEND_PORT ?? 5000);
const now = Date.now();

const project = {
  id: "qa-project",
  name: "Skyline Tycoon",
  description:
    "Build a cooperative futuristic city, automate production chains, and expand across floating islands.",
  type: "Tycoon Builder",
  gameType: "Tycoon Builder",
  genre: "Tycoon",
  difficulty: "Medium",
  players: "1–12",
  targetAudience: "Ages 10+",
  status: "ready",
  progress: 100,
  createdAt: new Date(now - 14 * 86_400_000).toISOString(),
  updatedAt: new Date(now - 3_600_000).toISOString(),
  thumbnailHue: 214,
};

const execution = {
  id: "exec-qa-001",
  blueprint_id: "blueprint-qa",
  project_id: project.id,
  status: "completed",
  started_at: new Date(now - 7_200_000).toISOString(),
  completed_at: new Date(now - 5_400_000).toISOString(),
  total_duration_ms: 1_800_000,
  pipeline_steps: [
    { agent: "game-designer", status: "completed", duration_ms: 210_000 },
    { agent: "systems-architect", status: "completed", duration_ms: 340_000 },
    { agent: "lua-generator", status: "completed", duration_ms: 620_000 },
    { agent: "quality-controller", status: "completed", duration_ms: 180_000 },
  ],
};

const manifest = {
  format: "roblox-ai-studio-manifest",
  version: "1.0.0",
  exportedAt: new Date(now - 300_000).toISOString(),
  project,
  blueprint: {
    id: "blueprint-qa",
    project_id: project.id,
    name: project.name,
    description: project.description,
    status: "ready",
    version: 3,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  },
  executions: [execution],
};

const history = [
  {
    id: "history-1",
    projectId: project.id,
    pipelineId: execution.id,
    status: "completed",
    startedAt: now - 7_200_000,
    finishedAt: now - 5_400_000,
    duration: 1_800_000,
    stagesCompleted: 8,
    stagesTotal: 8,
    failures: 0,
  },
];

const agents = [
  {
    id: "game-designer",
    name: "Game Designer",
    role: "Game design",
    description: "Defines gameplay systems and player loops.",
    status: "completed",
    progress: 100,
  },
  {
    id: "systems-architect",
    name: "Systems Architect",
    role: "Architecture",
    description: "Structures services and dependencies.",
    status: "completed",
    progress: 100,
  },
  {
    id: "lua-generator",
    name: "Lua Generator",
    role: "Implementation",
    description: "Produces Roblox Lua modules.",
    status: "completed",
    progress: 100,
  },
  {
    id: "quality-controller",
    name: "Quality Controller",
    role: "Validation",
    description: "Runs governance and quality checks.",
    status: "completed",
    progress: 100,
  },
];

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(status >= 400 ? data : { success: true, data }));
}

function genericResult(pathname) {
  if (pathname.includes("analytics")) {
    return {
      status: "healthy",
      qualityScore: 92,
      recommendations: [
        "Keep the Studio bridge connected",
        "Run economy validation before export",
      ],
    };
  }
  if (pathname.includes("status")) {
    return { status: "healthy", connected: true, version: "1.0.0" };
  }
  return {
    status: "complete",
    success: true,
    score: 91,
    message: "QA fixture completed successfully.",
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? "http://127.0.0.1:4173";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader(
    "access-control-allow-methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const pathname = url.pathname;

  if (pathname === "/api/platform/auth/me") {
    json(res, {
      user: {
        id: "qa-user",
        displayName: "QA Developer",
        email: "qa@example.test",
        tier: "studio",
      },
    });
    return;
  }
  if (pathname === "/api/platform/auth/refresh") {
    json(res, { refreshed: true });
    return;
  }
  if (pathname === "/api/projects") {
    json(res, [project]);
    return;
  }
  if (pathname === `/api/projects/${project.id}`) {
    json(res, project);
    return;
  }
  if (pathname === `/api/projects/${project.id}/export`) {
    json(res, manifest);
    return;
  }
  if (pathname === `/api/projects/${project.id}/history`) {
    json(res, history);
    return;
  }
  if (pathname === `/api/projects/${project.id}/studio/status`) {
    json(res, {
      status: "connected",
      studioId: "studio-qa",
      lastSyncAt: new Date(now - 600_000).toISOString(),
      bridgeVersion: "1.4.0",
      pendingChanges: 2,
    });
    return;
  }
  if (pathname === `/api/chat/${project.id}/history`) {
    json(res, []);
    return;
  }
  if (pathname === "/api/system/agents") {
    json(res, agents);
    return;
  }
  if (pathname.startsWith("/api/")) {
    json(res, genericResult(pathname));
    return;
  }

  json(res, { success: false, error: "Not found" }, 404);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[workspace-responsive] mock backend listening on ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
