type JsonRecord = Record<string, unknown>;

export const WORKSPACE_STUDIO_VERIFICATION_STATUSES = [
  "idle",
  "queued",
  "delivered",
  "acknowledged",
  "verified",
  "failed",
] as const;

export type WorkspaceStudioVerificationStatus =
  (typeof WORKSPACE_STUDIO_VERIFICATION_STATUSES)[number];

export type WorkspaceStudioConnectionStatus =
  "connected" | "disconnected" | "syncing" | "error";

export interface WorkspaceStudioStatus extends JsonRecord {
  status: WorkspaceStudioConnectionStatus;
  studioId?: string;
  lastSyncAt?: string;
  bridgeVersion: string;
  message?: string;
  pendingChanges: number;
  artifactVerified: boolean;
  verificationStatus: WorkspaceStudioVerificationStatus;
  lastCommandId?: string;
  verifiedExecutionId?: string;
  verifiedArtifactCount?: number;
  verificationError?: string;
}

/**
 * Validates the project-scoped Studio status returned by the backend.
 * Verification claims fail closed when their type or evidence is inconsistent.
 */
export function parseWorkspaceStudioStatus(
  value: unknown,
): WorkspaceStudioStatus {
  const record = asRecord(value, "Studio status");
  const status = asEnum(
    record.status,
    ["connected", "disconnected", "syncing", "error"] as const,
    "Studio connection status",
  );
  const verificationStatus =
    record.verificationStatus === undefined
      ? "idle"
      : asEnum(
          record.verificationStatus,
          WORKSPACE_STUDIO_VERIFICATION_STATUSES,
          "Studio verification status",
        );
  const artifactVerified =
    record.artifactVerified === undefined
      ? false
      : asBoolean(record.artifactVerified, "Studio artifact verification");
  const verifiedExecutionId = asOptionalString(
    record.verifiedExecutionId,
    "verified execution id",
  );
  const verifiedArtifactCount = asOptionalCount(
    record.verifiedArtifactCount,
    "verified artifact count",
  );

  if (artifactVerified !== (verificationStatus === "verified")) {
    throw new Error("Invalid Studio verification claim");
  }
  if (
    verificationStatus === "verified" &&
    (!verifiedExecutionId ||
      verifiedArtifactCount === undefined ||
      verifiedArtifactCount < 1)
  ) {
    throw new Error("Incomplete Studio verification evidence");
  }

  return {
    ...record,
    status,
    studioId: asOptionalString(record.studioId, "Studio id"),
    lastSyncAt: asOptionalDateString(record.lastSyncAt, "Studio last sync"),
    bridgeVersion:
      record.bridgeVersion === undefined
        ? "unknown"
        : asString(record.bridgeVersion, "Studio bridge version"),
    message: asOptionalString(record.message, "Studio status message"),
    pendingChanges:
      record.pendingChanges === undefined
        ? 0
        : asCount(record.pendingChanges, "Studio pending changes"),
    artifactVerified,
    verificationStatus,
    lastCommandId: asOptionalString(record.lastCommandId, "Studio command id"),
    verifiedExecutionId,
    verifiedArtifactCount,
    verificationError: asOptionalString(
      record.verificationError,
      "Studio verification error",
    ),
  };
}

export function disconnectedWorkspaceStudioStatus(): WorkspaceStudioStatus {
  return {
    status: "disconnected",
    bridgeVersion: "unknown",
    pendingChanges: 0,
    artifactVerified: false,
    verificationStatus: "idle",
    message: "Studio status is unavailable.",
  };
}

export function isWorkspaceStudioArtifactVerified(
  status: WorkspaceStudioStatus,
  latestExecutionId: string | undefined,
): boolean {
  return (
    Boolean(latestExecutionId) &&
    status.artifactVerified === true &&
    status.verificationStatus === "verified" &&
    status.verifiedExecutionId === latestExecutionId
  );
}

export function canSyncWorkspaceStudio(
  status: WorkspaceStudioStatus | undefined,
): boolean {
  return status?.status === "connected" || status?.status === "error";
}

export function describeWorkspaceStudioVerification(
  status: WorkspaceStudioStatus,
): string {
  switch (status.verificationStatus) {
    case "verified": {
      const count = status.verifiedArtifactCount ?? 0;
      const noun = count === 1 ? "artifact" : "artifacts";
      return `${count} generated ${noun} verified for execution ${status.verifiedExecutionId}.`;
    }
    case "failed":
      return (
        status.verificationError ??
        "Roblox Studio reported an artifact verification failure."
      );
    case "acknowledged":
      return "Roblox Studio acknowledged the export and is applying its artifacts.";
    case "delivered":
      return "The generated export reached Roblox Studio and awaits acknowledgement.";
    case "queued":
      return "Generated project artifacts are queued for Roblox Studio.";
    case "idle":
      return status.status === "disconnected"
        ? "Connect Roblox Studio before verifying generated artifacts."
        : "Artifact verification has not started. Sync the generated project to begin.";
  }
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asOptionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : asString(value, label);
}

function asOptionalDateString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return asString(value, label);
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asCount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asOptionalCount(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : asCount(value, label);
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
