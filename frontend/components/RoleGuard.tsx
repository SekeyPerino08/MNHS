"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPath } from "../lib/auth";
import { useAuth } from "../providers/AuthProvider";
import type { Role } from "../types/auth";

export function RoleGuard({
  allowedRoles,
  children,
}: Readonly<{ allowedRoles: readonly Role[]; children: ReactNode }>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      router.replace(dashboardPath(user.role));
    }
  }, [allowedRoles, loading, router, user]);

  if (loading || !user || user.mustChangePassword || !allowedRoles.includes(user.role)) {
    return (
      <main className="min-h-screen animate-pulse bg-slate-50 p-6" aria-label="Loading dashboard">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-12 rounded-xl bg-slate-200" />
          <div className="grid gap-5 md:grid-cols-3">
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  return children;
}
