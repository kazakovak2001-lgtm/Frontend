export type ProjectStatus = "draft" | "generating" | "ready" | "error" | "exported";

export type GameGenre =
  | "Simulator"
  | "Tycoon"
  | "Obby"
  | "RPG"
  | "FPS"
  | "Adventure"
  | "Roleplay"
  | "Racing"
  | "Horror"
  | "Other";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";

export interface Project {
  id: string;
  name: string;
  description: string;
  gameType: string;
  genre: GameGenre;
  difficulty: Difficulty;
  players: string;
  targetAudience: string;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  thumbnailHue: number;
  coverUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Pro" | "Studio";
  avatarUrl?: string;
}

export type AgentStatus = "idle" | "running" | "completed" | "queued" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  progress: number;
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  type: "project" | "export" | "agent" | "billing";
  timestamp: string;
}

export interface LogEntry {
  id: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  timestamp: string;
}
