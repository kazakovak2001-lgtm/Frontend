import type { Project, ActivityItem, ChatMessage, LogEntry } from "@/types";

export const MOCK_PROJECTS: Project[] = [
  {
    id: "prj_mining",
    name: "Mining Simulator",
    description: "Dig deep, collect rare ores, hatch pets and rebirth for permanent boosts.",
    gameType: "Mining Simulator",
    genre: "Simulator",
    difficulty: "Medium",
    players: "16-30",
    targetAudience: "Everyone",
    status: "ready",
    progress: 100,
    createdAt: "2026-06-10T09:00:00Z",
    updatedAt: "2026-06-22T14:30:00Z",
    thumbnailHue: 255,
  },
  {
    id: "prj_tycoon",
    name: "Mega City Tycoon",
    description: "Build your empire from a single shop into a sprawling automated city.",
    gameType: "Tycoon",
    genre: "Tycoon",
    difficulty: "Hard",
    players: "7-15",
    targetAudience: "Teens (13-17)",
    status: "generating",
    progress: 47,
    createdAt: "2026-06-18T11:00:00Z",
    updatedAt: "2026-06-25T08:10:00Z",
    thumbnailHue: 295,
  },
  {
    id: "prj_obby",
    name: "Neon Parkour Rush",
    description: "Race through 50 glowing obstacle stages with checkpoints and skins.",
    gameType: "Obby / Parkour",
    genre: "Obby",
    difficulty: "Easy",
    players: "30+",
    targetAudience: "Kids (under 13)",
    status: "draft",
    progress: 0,
    createdAt: "2026-06-24T16:00:00Z",
    updatedAt: "2026-06-24T16:00:00Z",
    thumbnailHue: 200,
  },
  {
    id: "prj_pets",
    name: "Pet Legends",
    description: "Collect, trade and evolve legendary pets across themed biomes.",
    gameType: "Pet Simulator",
    genre: "Simulator",
    difficulty: "Medium",
    players: "16-30",
    targetAudience: "Everyone",
    status: "exported",
    progress: 100,
    createdAt: "2026-05-30T10:00:00Z",
    updatedAt: "2026-06-20T12:00:00Z",
    thumbnailHue: 155,
  },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "act1",
    title: "Mining Simulator generated",
    description: "All 8 agents completed the pipeline successfully.",
    type: "project",
    timestamp: "2026-06-22T14:30:00Z",
  },
  {
    id: "act2",
    title: "Pet Legends exported",
    description: "Roblox project package exported (.rbxl).",
    type: "export",
    timestamp: "2026-06-20T12:00:00Z",
  },
  {
    id: "act3",
    title: "Designer agent running",
    description: "Mega City Tycoon — designing economy systems.",
    type: "agent",
    timestamp: "2026-06-25T08:10:00Z",
  },
  {
    id: "act4",
    title: "Plan upgraded to Pro",
    description: "Billing placeholder — subscription active.",
    type: "billing",
    timestamp: "2026-06-15T09:45:00Z",
  },
];

export const MOCK_CHAT: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Add a rebirth system that doubles mining speed each time.",
    createdAt: "2026-06-22T14:20:00Z",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "Great idea! I've drafted a rebirth system: each rebirth requires 2x the previous coin threshold and grants a permanent +100% mining speed multiplier. Pets and rebirth tokens persist across rebirths. Want me to add a prestige shop too?",
    createdAt: "2026-06-22T14:21:00Z",
  },
];

export const MOCK_LOGS: LogEntry[] = [
  { id: "l1", level: "info", message: "Pipeline initialized for project.", timestamp: "2026-06-22T14:00:00Z" },
  { id: "l2", level: "success", message: "Planner agent completed game design document.", timestamp: "2026-06-22T14:05:00Z" },
  { id: "l3", level: "info", message: "Designer agent started economy design.", timestamp: "2026-06-22T14:06:00Z" },
  { id: "l4", level: "warning", message: "High player count may require server sharding.", timestamp: "2026-06-22T14:08:00Z" },
  { id: "l5", level: "success", message: "Lua agent generated 24 scripts.", timestamp: "2026-06-22T14:20:00Z" },
];
