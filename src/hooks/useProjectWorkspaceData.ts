import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkspaceReadModel,
  type WorkspaceReadModel,
} from "@/services/workspaceReadModel";
import { createProjectRequestGuard } from "@/services/projectRequestGuard";

export interface ProjectWorkspaceDataState {
  data?: WorkspaceReadModel;
  loading: boolean;
  refreshing: boolean;
  error?: string;
  refresh: () => Promise<WorkspaceReadModel | undefined>;
}

/**
 * Loads the canonical persisted Workspace data over the existing backend API.
 * The hook owns request cancellation semantics but does not duplicate project,
 * chat, realtime, or generation state stores.
 *
 * `refresh` is handed out to callers that may invoke it long after this
 * hook's project has changed (e.g. after an unrelated mutation elsewhere in
 * the workspace route resolves). A stale call must never publish over a
 * newer project's data, so every call is tagged with the project id it was
 * created for and checked against both that identity and request ordering
 * before touching state - a shared, project-unaware counter alone lets a
 * stale call look "current" simply because nothing newer has incremented it
 * yet for the project it actually belongs to.
 */
export function useProjectWorkspaceData(
  projectId: string,
): ProjectWorkspaceDataState {
  const [data, setData] = useState<WorkspaceReadModel>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const guard = useRef(createProjectRequestGuard(projectId)).current;

  const refresh = useCallback(async () => {
    const token = guard.begin(projectId);
    setRefreshing(true);
    setError(undefined);

    try {
      const next = await loadWorkspaceReadModel(projectId);
      if (guard.isCurrent(token)) {
        setData(next);
      }
      return next;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Workspace data is unavailable";
      if (guard.isCurrent(token)) {
        setError(message);
      }
      return undefined;
    } finally {
      if (guard.isCurrent(token)) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId, guard]);

  useEffect(() => {
    guard.setActiveProject(projectId);
    setData(undefined);
    setLoading(true);
    setError(undefined);
    void refresh();

    return () => {
      guard.invalidate();
    };
  }, [projectId, refresh, guard]);

  return { data, loading, refreshing, error, refresh };
}
