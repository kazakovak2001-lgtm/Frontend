# Workspace route architecture

The frontend uses TanStack file-based routing and a single authenticated workspace model.

```text
/                         public product landing
/login                    cookie-session login
/register                 account creation
/forgot-password          password-reset request
/dashboard                authenticated project overview
/projects                 project search, filters and CRUD
/projects/new             validated creation and queued generation
/projects/$projectId      unified project workspace
/agents                   backend agent status
/settings                 profile, preferences and availability states
```

`/projects/$projectId` is the product hub. Its tabs expose overview, backend modules, generated manifest, persistent AI chat, realtime agents/logs, project settings and export. Project and run identity live in shared contexts; screens do not maintain independent copies.

Integration boundaries:

- `src/services/backendApi.ts` owns REST paths, request/response normalization and refresh retry.
- `src/services/realtime.ts` owns the credentialed Socket.IO singleton.
- `src/hooks/useProjectRealtime.ts` owns project-room membership and event mapping.
- `src/contexts/AuthContext.tsx`, `ProjectsContext.tsx` and `WorkspaceContext.tsx` own shared application state.

No route uses mock project, auth, chat or agent data. External capabilities that need deployment configuration are represented as explicit unavailable/disconnected states.
