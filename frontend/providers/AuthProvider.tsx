"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "../lib/api";
import type { AuthUser, LoginInput } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const redirectIfPasswordChangeRequired = useCallback((nextUser: AuthUser) => {
    if (nextUser.mustChangePassword && window.location.pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [router]);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const result = await apiFetch<{ user: AuthUser }>("/api/auth/me");
      setUser(result.user);
      redirectIfPasswordChangeRequired(result.user);
      return result.user;
    } catch (error) {
      setUser(null);
      if (!(error instanceof ApiError && error.status === 401)) {
        console.error("Could not restore the authenticated session:", error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [redirectIfPasswordChangeRequired]);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then((result) => {
        if (active) {
          setUser(result.user);
          redirectIfPasswordChangeRequired(result.user);
        }
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof ApiError && error.status === 401)) {
          console.error("Could not restore the authenticated session:", error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [redirectIfPasswordChangeRequired]);

  const login = useCallback(async (input: LoginInput): Promise<AuthUser> => {
    const result = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        console.error("Could not complete the logout request:", error);
      }
    } finally {
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const logoutAll = useCallback(async (): Promise<void> => {
    await apiFetch<void>("/api/auth/logout-all", { method: "POST" });
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, logout, logoutAll, refresh }), [user, loading, login, logout, logoutAll, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
