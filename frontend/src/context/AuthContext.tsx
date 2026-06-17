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
import type { AdminUser } from "../types";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: AdminUser | null }>(endpoints.auth.me);
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
    const { data } = await api.post<{ user: AdminUser }>(endpoints.auth.google, { credential });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post(endpoints.auth.logout);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin: !!user, loginWithGoogle, logout }}
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
