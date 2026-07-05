import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Role = "user" | "dev" | "admin";

export interface AuthUser {
  email: string;
  name: string;
  role: Role;
  /** Demo accounts get a role switcher in the nav (see App.tsx). */
  demo?: boolean;
}

const ROLE_RANK: Record<Role, number> = { user: 0, dev: 1, admin: 2 };

export function roleMeets(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const STORAGE_KEY = "quoted.session";

function loadStoredSession(): { token: string; user: AuthUser } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(loadStoredSession);

  useEffect(() => {
    function onUnauthorized() {
      setSession(null);
      localStorage.removeItem(STORAGE_KEY);
    }
    window.addEventListener("quoted:unauthorized", onUnauthorized);
    return () => window.removeEventListener("quoted:unauthorized", onUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      user: session?.user ?? null,
      login: (token, user) => {
        const next = { token, user };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// api.ts dispatches this on any 401 so the session clears everywhere at
// once, instead of every call site needing to know about auth state.
export function dispatchUnauthorized() {
  window.dispatchEvent(new Event("quoted:unauthorized"));
}
