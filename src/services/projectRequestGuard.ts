import { createLatestRequestGuard } from "./autonomousSession.ts";

export interface ProjectRequestToken {
  readonly projectId: string;
  readonly requestId: number;
}

export interface ProjectRequestGuard {
  /** Record which project is currently active and invalidate every prior token. */
  setActiveProject(projectId: string): void;
  /** Invalidate outstanding tokens without changing the active project (effect cleanup). */
  invalidate(): void;
  /** Issue a token for an operation the caller believes belongs to `projectId`. */
  begin(projectId: string): ProjectRequestToken;
  /** True only if `token.projectId` is still the active project AND no newer token has been issued. */
  isCurrent(token: ProjectRequestToken): boolean;
}

/**
 * A stale-result guard generalized for callers whose async closures may
 * capture a project id long before they resolve (e.g. a `refresh()`
 * function handed to another component and invoked later, well after the
 * project that started it is no longer active). Staleness is decided by two
 * independent facts: the request must belong to the project that is
 * *currently* active (`setActiveProject`), and it must still be the
 * *latest* request issued. Neither check alone is sufficient - a shared,
 * project-unaware counter can let a stale request from an old project look
 * "current" simply because nothing newer has incremented it yet.
 */
export function createProjectRequestGuard(
  initialProjectId: string,
): ProjectRequestGuard {
  let activeProjectId = initialProjectId;
  const guard = createLatestRequestGuard();

  return {
    setActiveProject(projectId) {
      activeProjectId = projectId;
      guard.invalidate();
    },
    invalidate() {
      guard.invalidate();
    },
    begin(projectId) {
      return { projectId, requestId: guard.begin() };
    },
    isCurrent(token) {
      return (
        token.projectId === activeProjectId && guard.isCurrent(token.requestId)
      );
    },
  };
}
