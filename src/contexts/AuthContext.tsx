import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/types";

// FUTURE INTEGRATION: replace localStorage mock auth with real
// authentication (Lovable Cloud / OAuth providers / JWT sessions).

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  register: (name: string, email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "ras_user";

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
  }, []);

  const persist = (next: User | null) => {
    setUser(next);
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const login = async (email: string) => {
    await new Promise((r) => setTimeout(r, 700));
    persist({
      id: "usr_demo",
      name: email.split("@")[0] || "Developer",
      email,
      plan: "Pro",
    });
  };

  const register = async (name: string, email: string) => {
    await new Promise((r) => setTimeout(r, 800));
    persist({ id: "usr_demo", name: name || "Developer", email, plan: "Free" });
  };

  const logout = () => persist(null);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, register, logout }}
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
