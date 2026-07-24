import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/types";
import { backendApi, BackendApiError } from "@/services/backendApi";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "ras_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    backendApi.auth
      .me()
      .then((next) => {
        setUser(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      })
      .catch((error) => {
        if (!(error instanceof BackendApiError) || error.status !== 401) {
          console.warn("[auth] backend session check failed", error);
        }
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = (next: User | null) => {
    setUser(next);
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const login = async (email: string, password: string) => {
    persist(await backendApi.auth.login(email, password));
  };

  const register = async (name: string, email: string, password: string) => {
    persist(await backendApi.auth.register(name, email, password));
  };

  const logout = async () => {
    await backendApi.auth.logout().catch((error) => {
      console.warn("[auth] backend logout failed", error);
    });
    persist(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
