"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { ErrorState } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { useMyEnrollment } from "../../../features/class-offerings/hooks";
import { useAuth } from "../../../providers/AuthProvider";
import { userDisplayName } from "../../../lib/auth";
import { useMyAttendance } from "../../../features/attendance/hooks";
import { formatRate } from "../../../features/attendance/config";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const query = useMyEnrollment();
  const attendance = useMyAttendance({ page: 1, pageSize: 100 });
  const enrollment = query.data?.enrollment;
  return <RoleGuard allowedRoles={["STUDENT"]}>
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student dashboard</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Welcome{user ? `, ${userDisplayName(user)}` : ""}</h1><p className="mt-1 text-sm text-slate-500">Your current school information.</p></header>
        {query.isError ? <ErrorState title="Could not load your dashboard" error={query.error} retry={() => void query.refetch()} /> : query.isLoading ? <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-32 rounded-2xl bg-slate-200" /></div> : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StudentStat icon={<GraduationCap size={20} />} label="Section" value={enrollment?.section ? `Grade ${enrollment.section.gradeLevel} · ${enrollment.section.name}` : "Not enrolled"} />
            <StudentStat icon={<BookOpen size={20} />} label="Subjects" value={String(query.data?.classOfferings.length ?? 0)} />
            <StudentStat icon={<GraduationCap size={20} />} label="Adviser" value={enrollment?.section?.adviser ? `${enrollment.section.adviser.firstName} ${enrollment.section.adviser.lastName}` : "Not assigned"} />
            <StudentStat icon={<BookOpen size={20} />} label="My grades" value="Coming soon" />
            <Link href="/student/attendance" className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><StudentStat icon={<ClipboardCheck size={20} />} label="My attendance" value={attendance.isLoading ? "Loading…" : attendance.isError ? "Unavailable" : attendance.data?.records.length ? formatRate(attendance.data.summary.overall.rate) : "No records yet"} /></Link>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">My learning</h2><p className="mt-1 text-sm text-slate-500">{enrollment ? `School year ${enrollment.schoolYear.name}` : "Contact the registrar to complete your enrollment."}</p></div><Link href="/student/subjects" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">View my subjects</Link></div></section>
        </>}
      </div>
    </DashboardLayout>
  </RoleGuard>;
}

function StudentStat({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{icon}</span></div><p className="mt-5 text-lg font-bold text-slate-900">{value}</p></section>;
}
