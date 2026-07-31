export type AutonomousSessionStatus =
  | "running"
  | "completed"
  | "preview_completed"
  | "simulated"
  | "paused"
  | "cancelled"
  | "failed";

export interface AutonomousPhase {
  id: string;
  phase: string;
  status: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface AutonomousCheckpoint {
  id: string;
  phase: string;
  timestamp: number;
}

export interface AutonomousCost {
  totalTokens: number;
  totalCost: number;
  totalTimeMs: number;
}

export interface AutonomousSession {
  id: string;
  projectId: string;
  status: AutonomousSessionStatus;
  currentPhase: string;
  phases: AutonomousPhase[];
  checkpoints: AutonomousCheckpoint[];
  cost: AutonomousCost;
  qualityScore: number | null;
  startedAt: number;
  finishedAt?: number;
  recoveryCount: number;
  restartInterruptedAt?: number;
  recoveryReason?: "server_restart";
  terminalEvidenceId?: string;
}

const SESSION_STATUSES = new Set<AutonomousSessionStatus>([
  "running",
  "completed",
  "preview_completed",
  "simulated",
  "paused",
  "cancelled",
  "failed",
]);

export function parseAutonomousSession(value: unknown): AutonomousSession {
  const record = asRecord(value, "autonomous session");
  const rawStatus = asString(record.status, "autonomous session status");
  if (!SESSION_STATUSES.has(rawStatus as AutonomousSessionStatus)) {
    throw new Error(`Invalid autonomous session status: ${rawStatus}`);
  }

  const checkpoints = Array.isArray(record.checkpoints)
    ? [
        ...new Map(
          record.checkpoints.map((checkpoint) => {
            const parsed = parseCheckpoint(checkpoint);
            return [parsed.id, parsed] as const;
          }),
        ).values(),
      ]
    : [];

  return {
    id: asString(record.id, "autonomous session id"),
    projectId: asString(record.projectId, "autonomous project id"),
    status: rawStatus as AutonomousSessionStatus,
    currentPhase: asString(record.currentPhase, "autonomous current phase"),
    phases: Array.isArray(record.phases) ? record.phases.map(parsePhase) : [],
    checkpoints,
    cost: parseCost(record.cost),
    qualityScore:
      record.qualityScore === null
        ? null
        : asFiniteNumber(record.qualityScore, "autonomous quality score"),
    startedAt: asFiniteNumber(record.startedAt, "autonomous start time"),
    finishedAt: optionalNumber(record.finishedAt),
    recoveryCount: asFiniteNumber(
      record.recoveryCount,
      "autonomous recovery count",
    ),
    restartInterruptedAt: optionalNumber(record.restartInterruptedAt),
    recoveryReason:
      record.recoveryReason === "server_restart" ? "server_restart" : undefined,
    terminalEvidenceId:
      typeof record.terminalEvidenceId === "string"
        ? record.terminalEvidenceId
        : undefined,
  };
}

function parsePhase(value: unknown): AutonomousPhase {
  const record = asRecord(value, "autonomous phase");
  return {
    id: asString(record.id, "autonomous phase id"),
    phase: asString(record.phase, "autonomous phase name"),
    status: asString(record.status, "autonomous phase status"),
    startedAt: optionalNumber(record.startedAt),
    completedAt: optionalNumber(record.completedAt),
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

function parseCheckpoint(value: unknown): AutonomousCheckpoint {
  const record = asRecord(value, "autonomous checkpoint");
  return {
    id: asString(record.id, "autonomous checkpoint id"),
    phase: asString(record.phase, "autonomous checkpoint phase"),
    timestamp: asFiniteNumber(
      record.timestamp,
      "autonomous checkpoint timestamp",
    ),
  };
}

function parseCost(value: unknown): AutonomousCost {
  const record = asRecord(value, "autonomous cost");
  return {
    totalTokens: asFiniteNumber(record.totalTokens, "autonomous token total"),
    totalCost: asFiniteNumber(record.totalCost, "autonomous cost total"),
    totalTimeMs: asFiniteNumber(record.totalTimeMs, "autonomous time total"),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
