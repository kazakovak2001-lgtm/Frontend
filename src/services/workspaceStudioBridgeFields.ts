export const STUDIO_SYNC_FIELD_KEYS = [
  "contractSync",
  "snapshotVersion",
  "pendingContractChanges",
  "syncConflicts",
] as const;

export type StudioSyncFieldKey = (typeof STUDIO_SYNC_FIELD_KEYS)[number];

export const STUDIO_CONNECTION_FIELD_KEYS = [
  "bridgeVersion",
  "lastSync",
  "pendingChanges",
  "verifiedExecution",
  "verifiedArtifacts",
] as const;

export type StudioConnectionFieldKey =
  (typeof STUDIO_CONNECTION_FIELD_KEYS)[number];

export type StudioBridgeFieldKey =
  | StudioSyncFieldKey
  | StudioConnectionFieldKey;

export type StudioBridgeFieldMarker = "sync" | "connection" | null;

const SYNC_KEYS: ReadonlySet<string> = new Set(STUDIO_SYNC_FIELD_KEYS);
const CONNECTION_KEYS: ReadonlySet<string> = new Set(
  STUDIO_CONNECTION_FIELD_KEYS,
);

export function isStudioSyncField(key: string): key is StudioSyncFieldKey {
  return SYNC_KEYS.has(key);
}

export function isStudioConnectionField(
  key: string,
): key is StudioConnectionFieldKey {
  return CONNECTION_KEYS.has(key);
}

/**
 * Classifies a Studio bridge panel field key as a project-scoped sync
 * contract field, a live plugin connection field, or neither. Used to
 * render sync fields with a distinct marker so they are never confused
 * with live connection status (see STUDIO-SYNC-1A-FE).
 */
export function studioBridgeFieldMarker(
  key: string,
): StudioBridgeFieldMarker {
  if (isStudioSyncField(key)) return "sync";
  if (isStudioConnectionField(key)) return "connection";
  return null;
}
