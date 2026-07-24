import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface WorkspaceRun {
  projectId: string;
  executionId: string;
  status: string;
  startedAt: string;
}

export interface WorkspaceRealtimeSnapshot {
  connected: boolean;
  status: "idle" | "running" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  updatedAt: string;
}

interface WorkspaceContextValue {
  activeProjectId?: string;
  setActiveProjectId: (projectId?: string) => void;
  runs: Record<string, WorkspaceRun>;
  setRun: (run: WorkspaceRun) => void;
  snapshots: Record<string, WorkspaceRealtimeSnapshot>;
  setSnapshot: (projectId: string, snapshot: WorkspaceRealtimeSnapshot) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [runs, setRuns] = useState<Record<string, WorkspaceRun>>({});
  const [snapshots, setSnapshots] = useState<
    Record<string, WorkspaceRealtimeSnapshot>
  >({});

  const setRun = useCallback((run: WorkspaceRun) => {
    setRuns((current) => ({ ...current, [run.projectId]: run }));
  }, []);

  const setSnapshot = useCallback(
    (projectId: string, snapshot: WorkspaceRealtimeSnapshot) => {
      setSnapshots((current) => ({ ...current, [projectId]: snapshot }));
    },
    [],
  );

  const value = useMemo(
    () => ({
      activeProjectId,
      setActiveProjectId,
      runs,
      setRun,
      snapshots,
      setSnapshot,
    }),
    [activeProjectId, runs, setRun, setSnapshot, snapshots],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
