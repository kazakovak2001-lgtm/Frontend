import type { Agent, GameGenre, Difficulty } from "@/types";

export const APP_NAME = "Roblox AI Studio";

export const GAME_TYPES = [
  "Mining Simulator",
  "Tycoon",
  "Obby / Parkour",
  "Pet Simulator",
  "Tower Defense",
  "Battle Royale",
  "Roleplay",
  "Racing",
  "Survival",
  "Custom",
] as const;

export const GENRES: GameGenre[] = [
  "Simulator",
  "Tycoon",
  "Obby",
  "RPG",
  "FPS",
  "Adventure",
  "Roleplay",
  "Racing",
  "Horror",
  "Other",
];

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Expert"];

export const PLAYER_COUNTS = [
  "1 (Single)",
  "2-6",
  "7-15",
  "16-30",
  "30+",
] as const;

export const TARGET_AUDIENCES = [
  "Kids (under 13)",
  "Teens (13-17)",
  "Adults (18+)",
  "Everyone",
] as const;

export const AGENT_BLUEPRINT: Agent[] = [
  {
    id: "planner",
    name: "Planner",
    role: "Game Architect",
    description:
      "Breaks the prompt into a structured game design document and task graph.",
    status: "completed",
    progress: 100,
    icon: "Map",
  },
  {
    id: "designer",
    name: "Designer",
    role: "Systems & Economy",
    description:
      "Designs gameplay loops, progression, economy, pets and rebirth systems.",
    status: "running",
    progress: 64,
    icon: "Palette",
  },
  {
    id: "builder",
    name: "Builder",
    role: "World Builder",
    description:
      "Generates the 3D world, maps, terrain and placement of game objects.",
    status: "queued",
    progress: 0,
    icon: "Boxes",
  },
  {
    id: "lua",
    name: "Lua",
    role: "Scripting Engine",
    description:
      "Writes optimized Luau scripts for mechanics, data stores and server logic.",
    status: "queued",
    progress: 0,
    icon: "Code2",
  },
  {
    id: "gui",
    name: "GUI",
    role: "Interface Designer",
    description:
      "Builds responsive in-game UI: shops, inventories, HUD and menus.",
    status: "idle",
    progress: 0,
    icon: "LayoutDashboard",
  },
  {
    id: "qa",
    name: "QA",
    role: "Quality Assurance",
    description:
      "Runs automated playtests, finds exploits and validates gameplay balance.",
    status: "idle",
    progress: 0,
    icon: "ShieldCheck",
  },
  {
    id: "security",
    name: "Security",
    role: "Anti-Exploit",
    description:
      "Hardens remote events, validates client input and prevents common exploits.",
    status: "idle",
    progress: 0,
    icon: "Lock",
  },
  {
    id: "documentation",
    name: "Documentation",
    role: "Tech Writer",
    description:
      "Produces developer docs, changelogs and onboarding guides for the project.",
    status: "idle",
    progress: 0,
    icon: "FileText",
  },
];
