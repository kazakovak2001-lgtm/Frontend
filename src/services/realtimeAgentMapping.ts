type JsonRecord = Record<string, unknown>;

export interface RealtimeAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  /** `"unknown"` when the backend did not report a recognized status - never inferred. */
  status: "idle" | "running" | "completed" | "queued" | "error" | "unknown";
  /** `undefined` when the backend did not report a progress value - never defaulted to 0. */
  progress?: number;
}

const KNOWN_AGENT_STATUSES = new Set<RealtimeAgent["status"]>([
  "idle",
  "running",
  "completed",
  "queued",
  "error",
]);

/** Absence of a recognized backend status is represented as `"unknown"`, never inferred as `"idle"`. */
export function normalizeAgentStatus(value: unknown): RealtimeAgent["status"] {
  return typeof value === "string" &&
    KNOWN_AGENT_STATUSES.has(value as RealtimeAgent["status"])
    ? (value as RealtimeAgent["status"])
    : "unknown";
}

/** Absence of a numeric backend progress value stays `undefined`, never defaulted to 0. */
export function normalizeAgentProgress(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * `/system/agents` serves a governance/registry listing, not a live status
 * feed - many payloads carry no `status`/`progress` at all. Both fields are
 * normalized independently: a recognized value passes through unchanged, an
 * absent or unrecognized one becomes an explicit `"unknown"`/`undefined`,
 * never a fabricated `"idle"`/`0`.
 */
export function mapAgent(raw: JsonRecord, index: number): RealtimeAgent {
  const id = String(raw.id ?? raw.agentId ?? raw.type ?? `agent-${index}`);
  return {
    id,
    name: String(raw.name ?? raw.type ?? id),
    role: String(raw.role ?? raw.type ?? "AI agent"),
    description: String(
      raw.description ?? raw.capabilities ?? "Backend orchestration agent",
    ),
    status: normalizeAgentStatus(raw.status),
    progress: normalizeAgentProgress(raw.progress),
  };
}
