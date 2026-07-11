import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getToken, login as apiLogin, logout as apiLogout } from "./api";
import { useMe } from "./hooks";
import type { Me } from "./types";

interface SessionValue {
  me: Me | null;
  role: Me["role"];
  isSignedIn: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean>(() => !!getToken());
  const meQuery = useMe(hasToken);

  const signIn = useCallback(
    async (username: string, password: string) => {
      await apiLogin(username, password);
      setHasToken(true);
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setHasToken(false);
    qc.clear();
  }, [qc]);

  const me = (hasToken ? meQuery.data : null) ?? null;

  const value = useMemo<SessionValue>(
    () => ({
      me,
      role: me?.role ?? "anonymous",
      isSignedIn: !!me,
      loading: hasToken && meQuery.isLoading,
      signIn,
      signOut,
    }),
    [me, hasToken, meQuery.isLoading, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession used outside SessionProvider");
  return ctx;
}

const RANK: Record<Me["role"], number> = {
  anonymous: 0,
  listener: 1,
  contributor: 2,
  editor: 3,
  admin: 4,
};
export function atLeast(role: Me["role"], min: Me["role"]): boolean {
  return RANK[role] >= RANK[min];
}
