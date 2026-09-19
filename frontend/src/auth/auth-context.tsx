import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { api, TOKEN_KEY } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

export type CashPeUser = {
  id: string;
  phone: string;
  name: string | null;
  has_pin: boolean;
};

type AuthState = {
  token: string | null;
  user: CashPeUser | null;
  loading: boolean;
  signIn: (token: string, user: CashPeUser) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<CashPeUser | null>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CashPeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet(TOKEN_KEY, "");
      if (t) {
        setToken(t as string);
        try {
          const me = await api.get("/me");
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (tok: string, usr: CashPeUser) => {
    await storage.secureSet(TOKEN_KEY, tok);
    setToken(tok);
    setUser(usr);
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get("/me");
    setUser(me);
    return me as CashPeUser;
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
