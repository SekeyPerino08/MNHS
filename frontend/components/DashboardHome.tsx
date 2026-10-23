import { BookOpen, ClipboardCheck, Users } from "lucide-react";
import { userDisplayName } from "../lib/auth";
import type { AuthUser } from "../types/auth";

const stats = [
  { label: "Students", icon: Users },
  { label: "Classes", icon: BookOpen },
  { label: "Attendance", icon: ClipboardCheck },
];

export function DashboardHome({ user }: Readonly<{ user: AuthUser }>) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
          {user.role.toLowerCase()} dashboard
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome, {userDisplayName(user)}
        </h1>
        <p className="mt-2 text-slate-500">Here is your school overview.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, icon: Icon }) => (
          <section key={label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-500">{label}</h2>
              <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                <Icon size={20} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-6 text-2xl font-semibold text-slate-400">—</p>
            <p className="mt-1 text-xs text-slate-400">Placeholder</p>
          </section>
        ))}
      </div>
    </div>
  );
}
