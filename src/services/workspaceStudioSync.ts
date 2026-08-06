type JsonRecord = Record<string, unknown>;

export interface StudioSyncStatus {
  lastSyncTimestamp: number | null;
  pendingChanges: number;
  conflictCount: number;
  currentVersion: string;
  projectId: string | null;
}

export interface ArtifactRef {
  id: string;
  type: string;
  name: string;
  stage: string;
  size: number;
  hash: string;
  version: number;
  createdAt: number;
  reviewStatus: string;
}

export interface ProjectSnapshot {
  projectId: string;
  version: string;
  artifacts: ArtifactRef[];
  generatedAt: number;
  artifactCount: number;
}

export type SyncChangeType = "create" | "update" | "delete";

export interface SyncChange {
  changeId: string;
  artifactId: string;
  artifactType: string;
  changeType: SyncChangeType;
  content: unknown;
  timestamp: number;
}

export interface ArtifactTransferResult {
  artifacts: Array<{
    id: string;
    type: string;
    name: string;
    stage: string;
    size: number;
    createdAt: number;
    reviewStatus: string;
    content: unknown;
  }>;
  missing: string[];
  totalSize: number;
  payloadExceeded: boolean;
}

export function unavailableStudioSyncStatus(
  projectId: string,
): StudioSyncStatus {
  return {
    lastSyncTimestamp: null,
    pendingChanges: 0,
    conflictCount: 0,
    currentVersion: "unavailable",
    projectId,
  };
}

export function parseStudioSyncStatus(value: unknown): StudioSyncStatus {
  const record = asRecord(value, "Studio sync status");
  return {
    lastSyncTimestamp:
      record.lastSyncTimestamp === null
        ? null
        : asNonNegativeNumber(
            record.lastSyncTimestamp,
            "Studio sync timestamp",
          ),
    pendingChanges: asNonNegativeInteger(
      record.pendingChanges,
      "Studio pending changes",
    ),
    conflictCount: asNonNegativeInteger(
      record.conflictCount,
      "Studio conflict count",
    ),
    currentVersion: asString(record.currentVersion, "Studio sync version"),
    projectId:
      record.projectId === null
        ? null
        : asString(record.projectId, "Studio sync project id"),
  };
}

export function parseProjectSnapshot(value: unknown): ProjectSnapshot {
  const record = asRecord(value, "Studio project snapshot");
  const artifacts = asArray(record.artifacts, "Studio snapshot artifacts").map(
    parseArtifactRef,
  );
  const artifactCount = asNonNegativeInteger(
    record.artifactCount,
    "Studio snapshot artifact count",
  );
  if (artifactCount !== artifacts.length) {
    throw new Error("Invalid Studio snapshot artifact count");
  }
  return {
    projectId: asString(record.projectId, "Studio snapshot project id"),
    version: asString(record.version, "Studio snapshot version"),
    artifacts,
    generatedAt: asNonNegativeNumber(
      record.generatedAt,
      "Studio snapshot generation time",
    ),
    artifactCount,
  };
}

export function parseArtifactTransferResult(
  value: unknown,
): ArtifactTransferResult {
  const record = asRecord(value, "Studio artifact transfer");
  return {
    artifacts: asArray(record.artifacts, "Studio transferred artifacts").map(
      (artifact) => {
        const item = asRecord(artifact, "Studio transferred artifact");
        return {
          id: asString(item.id, "Studio artifact id"),
          type: asString(item.type, "Studio artifact type"),
          name: asString(item.name, "Studio artifact name"),
          stage: asString(item.stage, "Studio artifact stage"),
          size: asNonNegativeInteger(item.size, "Studio artifact size"),
          createdAt: asNonNegativeNumber(
            item.createdAt,
            "Studio artifact creation time",
          ),
          reviewStatus: asString(
            item.reviewStatus,
            "Studio artifact review status",
          ),
          content: item.content,
        };
      },
    ),
    missing: asArray(record.missing, "Studio missing artifacts").map((id) =>
      asString(id, "Studio missing artifact id"),
    ),
    totalSize: asNonNegativeInteger(
      record.totalSize,
      "Studio transfer total size",
    ),
    payloadExceeded: asBoolean(
      record.payloadExceeded,
      "Studio transfer payload flag",
    ),
  };
}

function parseArtifactRef(value: unknown): ArtifactRef {
  const record = asRecord(value, "Studio artifact reference");
  return {
    id: asString(record.id, "Studio artifact id"),
    type: asString(record.type, "Studio artifact type"),
    name: asString(record.name, "Studio artifact name"),
    stage: asString(record.stage, "Studio artifact stage"),
    size: asNonNegativeInteger(record.size, "Studio artifact size"),
    hash: asString(record.hash, "Studio artifact hash"),
    version: asNonNegativeInteger(record.version, "Studio artifact version"),
    createdAt: asNonNegativeNumber(
      record.createdAt,
      "Studio artifact creation time",
    ),
    reviewStatus: asString(
      record.reviewStatus,
      "Studio artifact review status",
    ),
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
