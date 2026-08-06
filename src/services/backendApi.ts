import type { ChatMessage, Project, User } from "@/types";
import { runtimeEndpoints } from "@/config/runtime";
import {
  parseAutonomousSession,
  type AutonomousSession,
} from "@/services/autonomousSession";
import {
  parseArtifactTransferResult,
  parseProjectSnapshot,
  parseStudioSyncStatus,
} from "@/services/workspaceStudioSync";

const API_BASE_URL = runtimeEndpoints.apiBaseUrl;

type JsonRecord = Record<string, unknown>;
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export interface UserPreferences {
  appearance: "dark" | "system";
  notifications: {
    product: boolean;
    generation: boolean;
    marketing: boolean;
  };
}

export interface GenerationRecord {
  id: string;
  projectId: string;
  pipelineId: string;
  status: string;
  startedAt: number;
  finishedAt?: number;
  duration?: number;
  stagesCompleted: number;
  stagesTotal: number;
  failures: number;
}

export interface ConversationSummary {
  id: string;
  projectId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: PersistedMessage[];
}

export interface RealtimeAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: "idle" | "running" | "completed" | "queued" | "error";
  progress: number;
}

export class BackendApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.details = details;
  }
}

let refreshRequest: Promise<void> | null = null;

async function request<T>(
  path: string,
  init: RequestInit = {},
  canRefresh = true,
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...((init.headers ?? {}) as Record<string, string>),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (
    response.status === 401 &&
    canRefresh &&
    ![
      "/platform/auth/login",
      "/platform/auth/register",
      "/platform/auth/refresh",
    ].includes(path)
  ) {
    refreshRequest ??= request<unknown>(
      "/platform/auth/refresh",
      { method: "POST" },
      false,
    ).then(() => undefined);
    try {
      await refreshRequest;
      return request<T>(path, init, false);
    } finally {
      refreshRequest = null;
    }
  }

  if (!response.ok || payload.success === false) {
    throw new BackendApiError(
      payload.error ??
        payload.message ??
        `Backend request failed (${response.status})`,
      response.status,
      payload,
    );
  }
  return (payload.data ?? payload) as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function asIso(value: unknown): string {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toFrontendProject(raw: JsonRecord): Project {
  const rawStatus = String(raw.status ?? "draft").toLowerCase();
  const status: Project["status"] =
    rawStatus === "generating"
      ? "generating"
      : rawStatus === "ready" || rawStatus === "published"
        ? "ready"
        : rawStatus === "exported"
          ? "exported"
          : rawStatus === "failed" || rawStatus === "error"
            ? "error"
            : "draft";
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Untitled project"),
    description: String(raw.description ?? ""),
    gameType: String(raw.gameType ?? raw.type ?? raw.genre ?? "Game"),
    genre: normalizeGenre(raw.genre),
    difficulty: normalizeDifficulty(raw.difficulty),
    players: String(raw.players ?? "1–10"),
    targetAudience: String(raw.targetAudience ?? "Everyone"),
    status,
    progress:
      status === "ready" || status === "exported"
        ? 100
        : Number(raw.progress ?? raw.qualityScore ?? 0),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    thumbnailHue: Number(raw.thumbnailHue ?? projectHue(String(raw.id))),
    coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl : undefined,
  };
}

function normalizeGenre(value: unknown): Project["genre"] {
  const raw = String(value ?? "Other");
  const match = [
    "Simulator",
    "Tycoon",
    "Obby",
    "RPG",
    "FPS",
    "Adventure",
    "Roleplay",
    "Racing",
    "Horror",
    "Other",
  ].find((item) => item.toLowerCase() === raw.toLowerCase());
  return (match ?? "Other") as Project["genre"];
}

function normalizeDifficulty(value: unknown): Project["difficulty"] {
  const raw = String(value ?? "Medium");
  const match = ["Easy", "Medium", "Hard", "Expert"].find(
    (item) => item.toLowerCase() === raw.toLowerCase(),
  );
  return (match ?? "Medium") as Project["difficulty"];
}

function projectHue(id: string) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

function toFrontendUser(raw: JsonRecord): User {
  const tier = String(raw.plan ?? raw.tier ?? "free").toLowerCase();
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.displayName ?? "Developer"),
    email: String(raw.email ?? ""),
    plan:
      tier === "pro"
        ? "Pro"
        : tier === "enterprise" || tier === "studio"
          ? "Studio"
          : "Free",
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : undefined,
  };
}

export function projectToBlueprint(project: Project): JsonRecord {
  return {
    id: project.id,
    title: project.name,
    genre: project.genre.toLowerCase(),
    description: project.description,
    coreLoop: ["discover", "engage", "reward", "repeat"],
    mechanics: [
      project.gameType.toLowerCase(),
      "progression",
      "social interaction",
    ],
    world: {
      mapType: project.gameType,
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
      type: project.difficulty.toLowerCase(),
      stages: ["beginner", "intermediate", "advanced", "mastery"],
      unlockMechanism: "level-thresholds",
      estimatedPlaytime: "10-50 hours",
    },
    createdAt: project.createdAt,
  };
}

function projectIntent(project: Project) {
  return `Build ${project.name}, a ${project.genre} ${project.gameType}: ${project.description}`;
}

function projectDomainGenre(project: Project) {
  const genre = project.genre.toLowerCase().replace(/\s+/g, "_");
  return [
    "obby",
    "simulator",
    "tycoon",
    "rpg",
    "fps",
    "adventure",
    "horror",
  ].includes(genre)
    ? genre
    : "adventure";
}

function projectQualityInput(project: Project) {
  return {
    projectId: project.id,
    scripts: [
      {
        name: "Main",
        type: "server",
        path: "ServerScriptService/Main.server.lua",
        content:
          "-- Workspace validation fixture\nlocal Players = game:GetService('Players')\nreturn Players",
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
}

function mapAgent(raw: JsonRecord, index: number): RealtimeAgent {
  const id = String(raw.id ?? raw.agentId ?? raw.type ?? `agent-${index}`);
  return {
    id,
    name: String(raw.name ?? raw.type ?? id),
    role: String(raw.role ?? raw.type ?? "AI agent"),
    description: String(
      raw.description ?? raw.capabilities ?? "Backend orchestration agent",
    ),
    status: "idle",
    progress: 0,
  };
}

export const backendApi = {
  auth: {
    async login(email: string, password: string) {
      const data = await request<{ user: JsonRecord }>(
        "/platform/auth/login",
        json("POST", { email, password }),
        false,
      );
      return toFrontendUser(data.user);
    },
    async register(name: string, email: string, password: string) {
      const data = await request<{ user: JsonRecord }>(
        "/platform/auth/register",
        json("POST", { displayName: name, email, password }),
        false,
      );
      return toFrontendUser(data.user);
    },
    async me() {
      const data = await request<{ user: JsonRecord }>("/platform/auth/me");
      return toFrontendUser(data.user);
    },
    async logout() {
      await request("/platform/auth/logout", { method: "POST" }, false);
    },
    forgotPassword: (email: string) =>
      request<{ accepted: boolean; deliveryConfigured: boolean }>(
        "/platform/auth/forgot-password",
        json("POST", { email }),
        false,
      ),
  },

  users: {
    async update(id: string, input: { name: string; email: string }) {
      const data = await request<JsonRecord>(
        `/platform/users/${encodeURIComponent(id)}`,
        json("PATCH", { displayName: input.name, email: input.email }),
      );
      return toFrontendUser(data);
    },
    preferences: (id: string) =>
      request<UserPreferences>(
        `/platform/users/${encodeURIComponent(id)}/preferences`,
      ),
    savePreferences: (id: string, preferences: UserPreferences) =>
      request<UserPreferences>(
        `/platform/users/${encodeURIComponent(id)}/preferences`,
        json("PUT", preferences),
      ),
  },

  projects: {
    async list() {
      const data = await request<JsonRecord[]>("/projects");
      return data.map(toFrontendProject);
    },
    async get(id: string) {
      return toFrontendProject(
        await request<JsonRecord>(`/projects/${encodeURIComponent(id)}`),
      );
    },
    async create(input: {
      name: string;
      type: string;
      genre: string;
      description: string;
      difficulty?: string;
      players?: string;
      targetAudience?: string;
    }) {
      return toFrontendProject(
        await request<JsonRecord>("/projects", json("POST", input)),
      );
    },
    async update(id: string, patch: Partial<Project>) {
      return toFrontendProject(
        await request<JsonRecord>(
          `/projects/${encodeURIComponent(id)}`,
          json("PUT", patch),
        ),
      );
    },
    remove: (id: string) =>
      request(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
    history: (id: string) =>
      request<GenerationRecord[]>(
        `/projects/${encodeURIComponent(id)}/history`,
      ),
    export: (id: string) =>
      request<JsonRecord>(`/projects/${encodeURIComponent(id)}/export`),
  },

  ai: {
    chat: (messages: ChatMessage[], project?: Project) =>
      request<{
        role: "assistant";
        content: string;
        model?: string;
        pipelineId?: string;
      }>(
        "/ai/chat",
        json("POST", {
          messages: messages.map(({ role, content }) => ({ role, content })),
          gameContext: project
            ? {
                projectId: project.id,
                name: project.name,
                genre: project.genre,
              }
            : undefined,
        }),
      ),
    startGeneration: (projectId: string, userId?: string) =>
      request<{ executionId: string; status: string }>(
        `/projects/${encodeURIComponent(projectId)}/generate`,
        json("POST", { userId }),
      ),
    generationStatus: (projectId: string, executionId: string) =>
      request<JsonRecord>(
        `/projects/${encodeURIComponent(projectId)}/generation/${encodeURIComponent(executionId)}/status`,
      ),
  },

  workspace: {
    async agents() {
      const data = await request<JsonRecord[]>("/system/agents");
      return data.map(mapAgent);
    },
    systemStatus: () => request<JsonRecord>("/system/status"),
    analytics: {
      system: () => request<JsonRecord>("/analytics/system"),
      agents: () => request<JsonRecord>("/analytics/agents"),
      suggestions: () => request<JsonRecord>("/analytics/suggestions"),
      cycle: () => request<JsonRecord>("/analytics/cycle", { method: "POST" }),
    },
    knowledge: {
      search: (genre?: string, systems?: string[]) => {
        const params = new URLSearchParams();
        if (genre) params.set("genre", genre);
        if (systems?.length) params.set("systems", systems.join(","));
        return request<unknown[]>(`/knowledge/search?${params.toString()}`);
      },
      recommendations: (genre: string, systems: string[] = []) => {
        const params = new URLSearchParams({
          genre,
          systems: systems.join(","),
        });
        return request<JsonRecord>(`/knowledge/recommend?${params.toString()}`);
      },
    },
    simulation: (project: Project, ticks = 100) =>
      request<JsonRecord>(
        "/simulate/game",
        json("POST", { blueprint: projectToBlueprint(project), ticks }),
      ),
    economy: (project: Project, ticks = 200) =>
      request<JsonRecord>(
        "/economy/analyze",
        json("POST", { blueprint: projectToBlueprint(project), ticks }),
      ),
    studio: {
      status: (projectId: string) =>
        request<JsonRecord>(
          `/projects/${encodeURIComponent(projectId)}/studio/status`,
        ),
      sync: (projectId: string, studioId?: string) =>
        request<JsonRecord>(
          `/projects/${encodeURIComponent(projectId)}/studio/sync`,
          json("POST", { studioId }),
        ),
      syncStatus: (projectId: string) =>
        request<unknown>(
          `/studio/sync/status?projectId=${encodeURIComponent(projectId)}`,
        ).then(parseStudioSyncStatus),
      projectSnapshot: (projectId: string) =>
        request<unknown>(
          "/studio/sync/project",
          json("POST", { projectId }),
        ).then(parseProjectSnapshot),
      artifacts: (projectId: string, artifactIds: string[]) =>
        request<unknown>(
          "/studio/sync/artifacts",
          json("POST", { projectId, artifactIds }),
        ).then(parseArtifactTransferResult),
    },
    controller: {
      health: () => request<JsonRecord>("/controller/health"),
      preCheck: (project: Project) =>
        request<JsonRecord>(
          "/controller/pre-check",
          json("POST", {
            intent: `Validate planned changes for ${project.name}: ${project.description}`,
            name: project.name,
            type: "project",
          }),
        ),
      architectureScan: () =>
        request<JsonRecord>(
          "/controller/architecture/scan",
          json("POST", { action: "validate" }),
        ),
      duplicateCheck: (project: Project) =>
        request<JsonRecord>(
          "/controller/duplicates/check",
          json("POST", {
            name: project.name,
            description: project.description,
            category: project.genre,
            exports: [],
          }),
        ),
    },
    concept: (project: Project) =>
      request<JsonRecord>(
        "/concept/generate",
        json("POST", {
          gameDescription: projectIntent(project),
          genre: project.genre.toLowerCase(),
          style: project.gameType,
          targetAudience: project.targetAudience,
        }),
      ),
    architect: (project: Project) =>
      request<JsonRecord>(
        "/ai/game-architect/generate-design",
        json("POST", {
          description: projectIntent(project),
          genre: project.genre.toLowerCase(),
          targetAudience: project.targetAudience,
        }),
      ),
    planning: {
      async createAndExecute(project: Project) {
        const plan = await request<JsonRecord>(
          "/plan/create",
          json("POST", {
            intent: projectIntent(project),
            constraints: [
              `Difficulty: ${project.difficulty}`,
              `Players: ${project.players}`,
            ],
            projectId: project.id,
          }),
        );
        const execution = await request<JsonRecord>(
          "/plan/execute",
          json("POST", {
            planId: String(plan.planId),
            options: { stopOnFailure: false, maxRetries: 1 },
          }),
        );
        return { plan, execution };
      },
      dag: (project: Project) =>
        request<JsonRecord>(
          "/v2/plan/dag",
          json("POST", {
            intent: projectIntent(project),
            projectId: project.id,
          }),
        ),
    },
    generationCore: (project: Project) =>
      request<JsonRecord>(
        "/generate/game",
        json("POST", {
          intent: projectIntent(project),
          constraints: [`Players: ${project.players}`],
          projectId: project.id,
        }),
      ),
    compile: (project: Project) =>
      request<JsonRecord>(
        "/v1/compile",
        json("POST", {
          intent: projectIntent(project),
          constraints: [`Genre: ${project.genre}`],
          projectId: project.id,
        }),
      ),
    lua: (project: Project) =>
      request<JsonRecord>(
        "/lua/assemble-experience",
        json("POST", {
          projectId: project.id,
          gameName: project.name,
          genre: project.genre.toLowerCase(),
        }),
      ),
    world: (project: Project, ticks = 50) =>
      request<JsonRecord>(
        "/world/simulate",
        json("POST", { blueprint: projectToBlueprint(project), ticks }),
      ),
    lifecycle: async (project: Project) => {
      const started = await request<JsonRecord>(
        "/lifecycle/start",
        json("POST", { gameId: project.id }),
      );
      const cycle = await request<JsonRecord>(
        "/lifecycle/tick",
        json("POST", {
          gameId: project.id,
          blueprint: projectToBlueprint(project),
          simulationData: { engagementScore: 75 },
          economyData: { healthScore: 80 },
          worldData: { stability: 85, anomalyRate: 5 },
        }),
      );
      return { started, cycle };
    },
    memory: async (project: Project) => {
      await request(
        "/memory/store",
        json("POST", {
          agentId: "workspace",
          projectId: project.id,
          input: { intent: projectIntent(project) },
          output: { status: project.status },
          tags: ["workspace", project.genre.toLowerCase()],
        }),
      );
      const [search, stats] = await Promise.all([
        request<JsonRecord>(
          "/memory/search",
          json("POST", {
            agentId: "workspace",
            projectId: project.id,
            query: project.name,
            limit: 5,
          }),
        ),
        request<JsonRecord>("/memory/system/stats"),
      ]);
      return { search, stats };
    },
    evaluation: async () => {
      const run = await request<JsonRecord>(
        "/evaluation/run",
        json("POST", {}),
      );
      const history = await request<JsonRecord>("/evaluation/history");
      return { run, history };
    },
    playtest: (project: Project) =>
      request<JsonRecord>(
        "/playtest/run",
        json("POST", projectQualityInput(project)),
      ),
    repair: (project: Project) =>
      request<JsonRecord>(
        "/repair/run",
        json("POST", {
          ...projectQualityInput(project),
          config: { maxIterations: 2 },
        }),
      ),
    collaboration: (project: Project) =>
      request<JsonRecord>(
        "/agents/run",
        json("POST", {
          projectId: project.id,
          systems: [project.gameType.toLowerCase(), "progression", "economy"],
        }),
      ),
    domain: async (project: Project) => {
      const genre = projectDomainGenre(project);
      const [recommendations, benchmark] = await Promise.all([
        request<JsonRecord>(
          `/domain/recommendations?genre=${encodeURIComponent(genre)}`,
        ),
        request<JsonRecord>(
          "/domain/analyze",
          json("POST", {
            genre,
            systems: [project.gameType.toLowerCase(), "progression", "economy"],
            scriptCount: 1,
            assetCount: 1,
            hasMultiplayer: project.players !== "1",
          }),
        ),
      ]);
      return { recommendations, benchmark };
    },
    autonomous: {
      async start(project: Project): Promise<AutonomousSession> {
        const started = await request<{ sessionId: string }>(
          "/autonomous/run",
          json("POST", {
            prompt: projectIntent(project),
            projectId: project.id,
          }),
        );
        return parseAutonomousSession(
          await request<unknown>(
            `/autonomous/status/${encodeURIComponent(started.sessionId)}`,
          ),
        );
      },
      async latest(projectId: string): Promise<AutonomousSession> {
        return parseAutonomousSession(
          await request<unknown>(
            `/autonomous/project/${encodeURIComponent(projectId)}/latest`,
          ),
        );
      },
      async status(sessionId: string): Promise<AutonomousSession> {
        return parseAutonomousSession(
          await request<unknown>(
            `/autonomous/status/${encodeURIComponent(sessionId)}`,
          ),
        );
      },
      pause: (sessionId: string) =>
        request<{ status: string }>(
          `/autonomous/pause/${encodeURIComponent(sessionId)}`,
          { method: "POST" },
        ),
      resume: (sessionId: string) =>
        request<{ status: string }>(
          `/autonomous/resume/${encodeURIComponent(sessionId)}`,
          { method: "POST" },
        ),
      recover: (sessionId: string, checkpointId?: string) =>
        request<{ status: string }>(
          `/autonomous/recover/${encodeURIComponent(sessionId)}`,
          json("POST", { checkpointId }),
        ),
      cancel: (sessionId: string) =>
        request<{ status: string }>(
          `/autonomous/cancel/${encodeURIComponent(sessionId)}`,
          { method: "POST" },
        ),
    },
    distributed: {
      async status() {
        const [cluster, queue, workers] = await Promise.all([
          request<JsonRecord>("/distributed/cluster"),
          request<JsonRecord>("/distributed/queue"),
          request<JsonRecord>("/distributed/workers"),
        ]);
        return { cluster, queue, workers };
      },
      submit: (project: Project) =>
        request<JsonRecord>(
          "/distributed/submit",
          json("POST", {
            intent: projectIntent(project),
            projectId: project.id,
            priority: "normal",
          }),
        ),
    },
    diagnostics: () => request<JsonRecord>("/debug/executions"),
    versions: {
      list: (projectId: string) =>
        request<JsonRecord[]>(
          `/platform/versions/${encodeURIComponent(projectId)}`,
        ),
      save: (project: Project) =>
        request<JsonRecord>(
          `/platform/versions/${encodeURIComponent(project.id)}`,
          json("POST", {
            label: "workspace",
            qualityScore: project.progress,
            snapshot: project,
          }),
        ),
    },
    registry: async () => {
      const [agents, api] = await Promise.all([
        request<JsonRecord[]>("/platform/registry/agents"),
        request<JsonRecord>("/v2/status"),
      ]);
      return { agents, api };
    },
    chat: {
      history: (projectId: string) =>
        request<ConversationSummary[]>(
          `/chat/${encodeURIComponent(projectId)}/history`,
        ),
      conversation: (conversationId: string) =>
        request<Conversation>(
          `/chat/conversation/${encodeURIComponent(conversationId)}`,
        ),
      saveMessage: (body: {
        conversationId?: string;
        projectId?: string;
        role: "user" | "assistant" | "system";
        content: string;
      }) => request<PersistedMessage>("/chat/message", json("POST", body)),
      removeConversation: (conversationId: string) =>
        request(`/chat/conversation/${encodeURIComponent(conversationId)}`, {
          method: "DELETE",
        }),
    },
  },
};

export function getBackendBaseUrl() {
  return API_BASE_URL;
}
