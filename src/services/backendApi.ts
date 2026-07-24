import type { ChatMessage, Project, User } from "@/types";

const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000/api"
).replace(/\/$/, "");

export class BackendApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
  }
}

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...((init.headers ?? {}) as Record<string, string>),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new BackendApiError(
      payload.error ?? payload.message ?? "Backend request failed (" + response.status + ")",
      response.status,
    );
  }
  return (payload.data ?? payload) as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function toFrontendProject(raw: Record<string, unknown>): Project {
  const status = String(raw.status ?? "draft").toLowerCase();
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Untitled project"),
    description: String(raw.description ?? ""),
    gameType: String(raw.type ?? raw.gameType ?? raw.genre ?? "game"),
    genre: String(raw.genre ?? raw.type ?? "Other") as Project["genre"],
    difficulty: String(raw.difficulty ?? "Medium") as Project["difficulty"],
    players: String(raw.players ?? "1–10"),
    targetAudience: String(raw.targetAudience ?? "All ages"),
    status: (["draft", "generating", "ready", "error", "exported"].includes(status)
      ? status
      : "draft") as Project["status"],
    progress: Number(raw.progress ?? raw.qualityScore ?? 0),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    thumbnailHue: Number(raw.thumbnailHue ?? 220),
    coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl : undefined,
  };
}

function toFrontendUser(raw: Record<string, unknown>): User {
  const tier = String(raw.plan ?? raw.tier ?? "Free");
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.displayName ?? "Developer"),
    email: String(raw.email ?? ""),
    plan: (["Free", "Pro", "Studio"].includes(tier) ? tier : "Free") as User["plan"],
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : undefined,
  };
}

export const backendApi = {
  auth: {
    async login(email: string, password: string) {
      const data = await request<{ user: Record<string, unknown> }>(
        "/platform/auth/login",
        json("POST", { email, password }),
      );
      return toFrontendUser(data.user);
    },
    async register(name: string, email: string, password: string) {
      const data = await request<{ user: Record<string, unknown> }>(
        "/platform/auth/register",
        json("POST", { displayName: name, email, password }),
      );
      return toFrontendUser(data.user);
    },
    async me() {
      const data = await request<{ user: Record<string, unknown> }>("/platform/auth/me");
      return toFrontendUser(data.user);
    },
    async logout() {
      await request("/platform/auth/logout", { method: "POST" });
    },
  },

  projects: {
    async list() {
      const data = await request<unknown[]>("/projects");
      return data.map((item) => toFrontendProject(item as Record<string, unknown>));
    },
    async get(id: string) {
      const data = await request<Record<string, unknown>>("/projects/" + encodeURIComponent(id));
      return toFrontendProject(data);
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
      const data = await request<Record<string, unknown>>("/projects", json("POST", input));
      return toFrontendProject(data);
    },
    async update(id: string, patch: Partial<Project>) {
      const data = await request<Record<string, unknown>>(
        "/projects/" + encodeURIComponent(id),
        json("PUT", patch),
      );
      return toFrontendProject(data);
    },
    async remove(id: string) {
      await request("/projects/" + encodeURIComponent(id), { method: "DELETE" });
    },
    async history(id: string) {
      return request<unknown[]>("/projects/" + encodeURIComponent(id) + "/history");
    },
  },

  ai: {
    async chat(messages: ChatMessage[], projectId?: string) {
      return request<{ role: "assistant"; content: string; model?: string; pipelineId?: string }>(
        "/ai/chat",
        json("POST", {
          messages: messages.map(({ role, content }) => ({ role, content })),
          gameContext: projectId ? { projectId } : undefined,
        }),
      );
    },
    async startGeneration(projectId: string, userId?: string) {
      return request<{ executionId: string; status: string }>(
        "/projects/" + encodeURIComponent(projectId) + "/generate",
        json("POST", { projectId, userId }),
      );
    },
    async generationStatus(projectId: string, executionId: string) {
      return request<Record<string, unknown>>(
        "/projects/" + encodeURIComponent(projectId) + "/generation/" +
          encodeURIComponent(executionId) + "/status",
      );
    },
  },

  workspace: {
    agents: () => request<unknown[]>("/system/agents"),
    systemStatus: () => request<Record<string, unknown>>("/system/status"),
    analytics: {
      system: () => request<Record<string, unknown>>("/analytics/system"),
      agents: () => request<Record<string, unknown>>("/analytics/agents"),
      suggestions: () => request<Record<string, unknown>>("/analytics/suggestions"),
    },
    knowledge: {
      search: (genre?: string, systems?: string[]) => {
        const params = new URLSearchParams();
        if (genre) params.set("genre", genre);
        if (systems?.length) params.set("systems", systems.join(","));
        return request<unknown[]>("/knowledge/search?" + params.toString());
      },
      project: (projectId: string, query?: string) => {
        const suffix = query ? "?q=" + encodeURIComponent(query) : "";
        return request<Record<string, unknown>>(
          "/knowledge/project/" + encodeURIComponent(projectId) + suffix,
        );
      },
    },
    simulation: (body: unknown) => request<Record<string, unknown>>("/simulate/game", json("POST", body)),
    economy: (body: unknown) => request<Record<string, unknown>>("/economy/analyze", json("POST", body)),
    studio: {
      status: (projectId?: string) =>
        request<Record<string, unknown>>(
          projectId
            ? "/projects/" + encodeURIComponent(projectId) + "/studio/status"
            : "/studio/status",
        ),
      sync: (projectId: string, body: unknown = {}) =>
        request<Record<string, unknown>>(
          "/projects/" + encodeURIComponent(projectId) + "/studio/sync",
          json("POST", body),
        ),
    },
    controller: {
      health: () => request<Record<string, unknown>>("/controller/health"),
      preCheck: (body: unknown) => request<Record<string, unknown>>("/controller/pre-check", json("POST", body)),
      architectureScan: (body: unknown) =>
        request<Record<string, unknown>>("/controller/architecture/scan", json("POST", body)),
      duplicateCheck: (body: unknown) =>
        request<Record<string, unknown>>("/controller/duplicates/check", json("POST", body)),
    },
    chat: {
      history: (projectId: string) =>
        request<unknown[]>("/chat/" + encodeURIComponent(projectId) + "/history"),
      saveMessage: (body: unknown) => request<Record<string, unknown>>("/chat/message", json("POST", body)),
    },
  },
};

export function getBackendBaseUrl() {
  return API_BASE_URL;
}
