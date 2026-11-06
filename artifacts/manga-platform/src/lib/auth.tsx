import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken, type Me } from "./api";

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<unknown>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (getToken() ? await api<Me>("/auth/me").catch(() => null) : null),
    staleTime: 5 * 60_000,
  });

  const login = useCallback(async (token: string) => {
    setToken(token);
    await qc.invalidateQueries();
  }, [qc]);

  const logout = useCallback(() => {
    setToken(null);
    qc.setQueryData(["auth", "me"], null);
    qc.invalidateQueries();
  }, [qc]);

  const value = useMemo(() => ({ me: data ?? null, loading: isLoading, login, logout, refresh: refetch }), [data, isLoading, login, logout, refetch]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
