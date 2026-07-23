import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Project } from "@/types";
import { MOCK_PROJECTS } from "@/constants/mock-data";

// FUTURE INTEGRATION: replace localStorage-backed mock store with real
// database-backed project CRUD via the backend API.

export type NewProjectInput = Omit<
  Project,
  "id" | "status" | "progress" | "createdAt" | "updatedAt" | "thumbnailHue"
>;

interface ProjectsContextValue {
  projects: Project[];
  getProject: (id: string) => Project | undefined;
  createProject: (input: NewProjectInput) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);
const STORAGE_KEY = "ras_projects";

function readStored(): Project[] {
  if (typeof window === "undefined") return MOCK_PROJECTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : MOCK_PROJECTS;
  } catch {
    return MOCK_PROJECTS;
  }
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);

  useEffect(() => {
    setProjects(readStored());
  }, []);

  const persist = (next: Project[]) => {
    setProjects(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const createProject = (input: NewProjectInput): Project => {
    const now = new Date().toISOString();
    const project: Project = {
      ...input,
      id: `prj_${Math.random().toString(36).slice(2, 9)}`,
      status: "generating",
      progress: Math.floor(Math.random() * 30) + 10,
      createdAt: now,
      updatedAt: now,
      thumbnailHue: Math.floor(Math.random() * 360),
    };
    persist([project, ...projects]);
    return project;
  };

  const updateProject = (id: string, patch: Partial<Project>) => {
    const now = new Date().toISOString();
    persist(projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)));
  };

  const deleteProject = (id: string) => persist(projects.filter((p) => p.id !== id));

  const duplicateProject = (id: string) => {
    const original = projects.find((p) => p.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy: Project = {
      ...original,
      id: `prj_${Math.random().toString(36).slice(2, 9)}`,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    persist([copy, ...projects]);
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  return (
    <ProjectsContext.Provider
      value={{ projects, getProject, createProject, updateProject, deleteProject, duplicateProject }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
