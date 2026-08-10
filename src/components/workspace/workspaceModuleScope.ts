import {
  createProjectRequestGuard,
  type ProjectRequestGuard,
} from "../../services/projectRequestGuard.ts";
import type { WorkspaceModuleKey } from "./workspaceLogic.ts";

export interface WorkspaceModuleRequestToken {
  readonly key: WorkspaceModuleKey;
  readonly projectId: string;
  readonly requestId: number;
}

export interface WorkspaceModuleScope {
  /** Record which project is active and invalidate every key's outstanding tokens. */
  setActiveProject(projectId: string): void;
  /** Invalidate every key's outstanding tokens without changing the active project (effect cleanup). */
  invalidateAll(): void;
  begin(
    key: WorkspaceModuleKey,
    projectId: string,
  ): WorkspaceModuleRequestToken;
  isCurrent(token: WorkspaceModuleRequestToken): boolean;
}

/**
 * WorkspaceModules renders one card per backend tool key and is reused
 * across project switches (no remount). Each key's async invocation needs
 * its own independent stale-result guard - a click on "Compile project"
 * must never be superseded by a click on "Analyze economy" - but all keys
 * share the same notion of "which project is active right now", since a
 * project switch invalidates every key's in-flight request at once.
 */
export function createWorkspaceModuleScope(
  keys: readonly WorkspaceModuleKey[],
  initialProjectId: string,
): WorkspaceModuleScope {
  const guards = new Map<WorkspaceModuleKey, ProjectRequestGuard>(
    keys.map((key) => [key, createProjectRequestGuard(initialProjectId)]),
  );

  function guardFor(key: WorkspaceModuleKey): ProjectRequestGuard {
    const guard = guards.get(key);
    if (!guard) {
      throw new Error(`Unknown workspace module key: ${key}`);
    }
    return guard;
  }

  return {
    setActiveProject(projectId) {
      for (const guard of guards.values()) guard.setActiveProject(projectId);
    },
    invalidateAll() {
      for (const guard of guards.values()) guard.invalidate();
    },
    begin(key, projectId) {
      const { requestId } = guardFor(key).begin(projectId);
      return { key, projectId, requestId };
    },
    isCurrent(token) {
      return guardFor(token.key).isCurrent({
        projectId: token.projectId,
        requestId: token.requestId,
      });
    },
  };
}
