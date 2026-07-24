import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Project } from "@/types";
import { backendApi } from "@/services/backendApi";

export type NewProjectInput = Omit<
  Project,
  "id" | "status" | "progress" | "createdAt" | "updatedAt" | "thumbnailHue"
>;

interface ProjectsContextValue {
  projects: Project[];
  isLoading: boolean;
  getProject: (id: string) => Project | undefined;
  createProject: (input: NewProjectInput) => Promise<Project>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    backendApi.projects
      .list()
      .then(setProjects)
      .catch((error) => {
        console.warn("[projects] backend load failed", error);
        setProjects([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const createProject = async (input: NewProjectInput) => {
    const project = await backendApi.projects.create({
      name: input.name,
      type: input.gameType,
      genre: input.genre,
      description: input.description,
      difficulty: input.difficulty,
      players: input.players,
      targetAudience: input.targetAudience,
    });
    setProjects((current) => [project, ...current]);
    return project;
  };

  const updateProject = async (id: string, patch: Partial<Project>) => {
    const project = await backendApi.projects.update(id, patch);
    setProjects((current) => current.map((item) => (item.id === id ? project : item)));
  };

  const deleteProject = async (id: string) => {
    await backendApi.projects.remove(id);
    setProjects((current) => current.filter((item) => item.id !== id));
  };

  const duplicateProject = async (id: string) => {
    const original = projects.find((p) => p.id === id);
    if (!original) return;
    await createProject({
      name: original.name + " (Copy)",
      description: original.description,
      gameType: original.gameType,
      genre: original.genre,
      difficulty: original.difficulty,
      players: original.players,
      targetAudience: original.targetAudience,
    });
  };

  const getProject = (id: string) => projects.find((project) => project.id === id);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        isLoading,
        getProject,
        createProject,
        updateProject,
        deleteProject,
        duplicateProject,
      }}
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
