import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { endpoints } from "../api/endpoints";
import { api } from "../lib/api";
import type { AuthUser, Role } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  role: Role | null;
  isAdmin: boolean;
  isVisitor: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: AuthUser | null }>(endpoints.auth.me);
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const { data } = await api.post<{ user: AuthUser }>(endpoints.auth.google, { credential });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post(endpoints.auth.logout);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        role: user?.role ?? null,
        isAdmin: user?.role === "admin",
        isVisitor: user?.role === "visitor",
        loginWithGoogle,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
