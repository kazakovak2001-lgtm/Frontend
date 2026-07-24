import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkspaceReadModel,
  type WorkspaceReadModel,
} from "@/services/workspaceReadModel";

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
 */
export function useProjectWorkspaceData(
  projectId: string,
): ProjectWorkspaceDataState {
  const [data, setData] = useState<WorkspaceReadModel>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setError(undefined);

    try {
      const next = await loadWorkspaceReadModel(projectId);
      if (requestId === requestIdRef.current) {
        setData(next);
      }
      return next;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Workspace data is unavailable";
      if (requestId === requestIdRef.current) {
        setError(message);
      }
      return undefined;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    setData(undefined);
    setLoading(true);
    setError(undefined);
    void refresh();

    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { data, loading, refreshing, error, refresh };
}
