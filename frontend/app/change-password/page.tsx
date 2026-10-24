"use client";

import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "../../features/profile/ChangePasswordForm";
import { dashboardPath } from "../../lib/auth";
import { useAuth } from "../../providers/AuthProvider";

export default function ChangePasswordPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.mustChangePassword && window.location.pathname === "/change-password") {
      router.replace(dashboardPath(user.role));
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100" aria-label="Loading account">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    </main>;
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
    <section className="w-full max-w-lg rounded-3xl border border-white bg-white p-6 shadow-xl sm:p-9">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          {user.mustChangePassword ? <ShieldCheck size={27} aria-hidden="true" /> : <GraduationCap size={27} aria-hidden="true" />}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Change your password</h1>
        <p className="mt-2 text-sm text-slate-500">Keep your account secure with a password only you know.</p>
      </div>
      <ChangePasswordForm forced={user.mustChangePassword} />
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        {!user.mustChangePassword
          ? <Link href={dashboardPath(user.role)} className="font-medium text-indigo-700 hover:underline">Back to dashboard</Link>
          : <span />}
        <button type="button" onClick={() => void logout()} className="font-medium text-slate-600 hover:text-slate-900">Sign out</button>
      </div>
    </section>
  </main>;
}
