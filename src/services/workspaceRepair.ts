import {
  parseWorkspaceStudioStatus,
  type WorkspaceStudioStatus,
} from "./workspaceStudioStatus.ts";

type JsonRecord = Record<string, unknown>;

export type RepairSessionStatus =
  | "running"
  | "completed"
  | "stopped"
  | "timeout";

export interface RepairIterationRecord {
  iteration: number;
  changedArtifacts: string[];
  scoreBefore: number;
  scoreAfter: number;
  duration: number;
  repairsApplied: number;
  timestamp: number;
  newExecutionId?: string;
  parentExecutionId: string;
  strategyResults: unknown[];
}

export type RepairDeliverySource = "latest-repair" | "explicit-rollback";

export interface RepairDeliveryRecord {
  timestamp: number;
  executionId: string;
  studioId: string;
  source: RepairDeliverySource;
  success: boolean;
  error?: string;
}

export interface RepairSession {
  projectId: string;
  status: RepairSessionStatus;
  currentIteration: number;
  maxIterations: number;
  targetScore: number;
  currentScore: number;
  history: RepairIterationRecord[];
  deliveries: RepairDeliveryRecord[];
  startedAt: number;
  finishedAt?: number;
  totalRepairs: number;
  stopReason?: string;
}

export interface RepairSyncResult {
  success: boolean;
  sessionId: string;
  payloadId: string;
  itemsSynced: number;
  totalSize: number;
  durationMs: number;
  error?: string;
}

export interface RepairDeliverResult {
  executionId: string;
  syncResult: RepairSyncResult;
}

export interface RepairDeliveriesEnvelope {
  deliveries: RepairDeliveryRecord[];
  currentStudioState: WorkspaceStudioStatus | null;
}

export function parseRepairIterationRecord(
  value: unknown,
): RepairIterationRecord {
  const record = asRecord(value, "Repair iteration record");
  return {
    iteration: asNonNegativeInteger(record.iteration, "Repair iteration"),
    changedArtifacts: asArray(
      record.changedArtifacts,
      "Repair changed artifacts",
    ).map((id) => asString(id, "Repair changed artifact id")),
    scoreBefore: asNonNegativeNumber(record.scoreBefore, "Repair score before"),
    scoreAfter: asNonNegativeNumber(record.scoreAfter, "Repair score after"),
    duration: asNonNegativeNumber(record.duration, "Repair duration"),
    repairsApplied: asNonNegativeInteger(
      record.repairsApplied,
      "Repair repairs-applied count",
    ),
    timestamp: asNonNegativeNumber(record.timestamp, "Repair timestamp"),
    newExecutionId: asOptionalString(
      record.newExecutionId,
      "Repair new execution id",
    ),
    parentExecutionId: asString(
      record.parentExecutionId,
      "Repair parent execution id",
    ),
    strategyResults: asArray(record.strategyResults, "Repair strategy results"),
  };
}

export function parseRepairDeliveryRecord(value: unknown): RepairDeliveryRecord {
  const record = asRecord(value, "Repair delivery record");
  return {
    timestamp: asNonNegativeNumber(record.timestamp, "Delivery timestamp"),
    executionId: asString(record.executionId, "Delivery execution id"),
    studioId: asString(record.studioId, "Delivery studio id"),
    source: asEnum(
      record.source,
      ["latest-repair", "explicit-rollback"] as const,
      "Delivery source",
    ),
    success: asBoolean(record.success, "Delivery success flag"),
    error: asOptionalString(record.error, "Delivery error"),
  };
}

export function parseRepairSession(value: unknown): RepairSession {
  const record = asRecord(value, "Repair session");
  return {
    projectId: asString(record.projectId, "Repair session project id"),
    status: asEnum(
      record.status,
      ["running", "completed", "stopped", "timeout"] as const,
      "Repair session status",
    ),
    currentIteration: asNonNegativeInteger(
      record.currentIteration,
      "Repair current iteration",
    ),
    maxIterations: asNonNegativeInteger(
      record.maxIterations,
      "Repair max iterations",
    ),
    targetScore: asNonNegativeNumber(record.targetScore, "Repair target score"),
    currentScore: asNonNegativeNumber(
      record.currentScore,
      "Repair current score",
    ),
    history: asArray(record.history, "Repair session history").map(
      parseRepairIterationRecord,
    ),
    deliveries:
      record.deliveries === undefined
        ? []
        : asArray(record.deliveries, "Repair session deliveries").map(
            parseRepairDeliveryRecord,
          ),
    startedAt: asNonNegativeNumber(record.startedAt, "Repair session start"),
    finishedAt:
      record.finishedAt === undefined
        ? undefined
        : asNonNegativeNumber(record.finishedAt, "Repair session finish"),
    totalRepairs: asNonNegativeInteger(
      record.totalRepairs,
      "Repair total repairs",
    ),
    stopReason: asOptionalString(record.stopReason, "Repair stop reason"),
  };
}

export function parseRepairSyncResult(value: unknown): RepairSyncResult {
  const record = asRecord(value, "Repair sync result");
  return {
    success: asBoolean(record.success, "Repair sync success flag"),
    sessionId: asString(record.sessionId, "Repair sync session id"),
    payloadId: asString(record.payloadId, "Repair sync payload id"),
    itemsSynced: asNonNegativeInteger(
      record.itemsSynced,
      "Repair sync items synced",
    ),
    totalSize: asNonNegativeInteger(record.totalSize, "Repair sync total size"),
    durationMs: asNonNegativeInteger(
      record.durationMs,
      "Repair sync duration",
    ),
    error: asOptionalString(record.error, "Repair sync error"),
  };
}

export function parseRepairDeliverResult(value: unknown): RepairDeliverResult {
  const record = asRecord(value, "Repair deliver result");
  return {
    executionId: asString(record.executionId, "Repair deliver execution id"),
    syncResult: parseRepairSyncResult(record.syncResult),
  };
}

export function parseRepairDeliveriesEnvelope(
  value: unknown,
): RepairDeliveriesEnvelope {
  const record = asRecord(value, "Repair deliveries envelope");
  return {
    deliveries: asArray(record.deliveries, "Repair deliveries").map(
      parseRepairDeliveryRecord,
    ),
    currentStudioState:
      record.currentStudioState === null ||
      record.currentStudioState === undefined
        ? null
        : parseWorkspaceStudioStatus(record.currentStudioState),
  };
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as JsonRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asOptionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : asString(value, label);
}

function asNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  const number = asNonNegativeNumber(value, label);
  if (!Number.isInteger(number)) throw new Error(`Invalid ${label}`);
  return number;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${label}`);
  return value;
}

function asEnum<const T extends readonly string[]>(
  value: unknown,
  options: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as T[number];
}
