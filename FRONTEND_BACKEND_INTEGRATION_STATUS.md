# Frontend ↔ Backend integration status

## Current architecture

The Frontend project is the presentation layer. The RobloxAiStudio-DevKit project remains the source of truth for:

- authentication and sessions,
- project persistence,
- AI providers and agent execution,
- generation and pipeline state,
- chat persistence,
- knowledge and controller checks,
- analytics, simulation and economy,
- Roblox Studio bridge and synchronization.

The frontend now communicates through one typed boundary:

    src/services/backendApi.ts

This prevents individual pages from inventing their own fetch logic or response mapping.

## Connected flows

| Frontend capability | Backend endpoint group | Status |
|---|---|---|
| Login | /api/platform/auth/login | connected |
| Registration | /api/platform/auth/register | connected |
| Session restore | /api/platform/auth/me | connected |
| Logout | /api/platform/auth/logout | connected |
| Project list | /api/projects | connected |
| Project detail data | /api/projects/:id | client available |
| Project create/update/delete | /api/projects | connected in ProjectsContext |
| Start generation | /api/projects/:projectId/generate | connected after project creation |
| AI chat | /api/ai/chat | connected |
| Chat history | /api/chat/:projectId/history | connected to project chat |
| Agents | /api/system/agents | client available |
| System status | /api/system/status | client available |
| Analytics | /api/analytics/* | client available |
| Knowledge | /api/knowledge/* | client available |
| Simulation | /api/simulate/game | client available |
| Economy | /api/economy/analyze | client available |
| Studio status and sync | /api/studio/* and project Studio routes | client available |
| AI Controller | /api/controller/* | client available |

## Important corrections

- Mock auth was replaced by backend cookie sessions.
- localStorage project CRUD was replaced by the backend project repository.
- mock AI replies were replaced by the real AI chat route.
- new project creation now starts the backend generation flow.
- the existing misspelled constants directory is kept for compatibility and exposed through the correct constants import path.

## Remaining integration work

1. Add the Workspace module pages that consume the already available agents, analytics, knowledge, simulation, economy, Studio and controller methods.
2. Add Socket.IO client wiring for live pipeline events. The backend already emits project-room events; the new frontend does not yet open a Socket.IO subscription.
3. Add a shared project/run context so all module pages keep the same projectId and executionId.
4. Add error, loading and permission states for every module.
5. Resolve the local Vite/Rolldown native binding issue and run production build.

The next implementation slice should be the unified Workspace shell and module registry. It should reuse these API methods instead of creating new service clients.
