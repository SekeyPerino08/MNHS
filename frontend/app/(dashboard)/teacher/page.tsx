"use client";

import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { ErrorState } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { useMyClasses } from "../../../features/class-offerings/hooks";
import { useAuth } from "../../../providers/AuthProvider";
import { userDisplayName } from "../../../lib/auth";
import { DailyAttendanceFlag } from "../../../features/attendance/components/DailyAttendanceFlag";

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const query = useMyClasses();
  const classes = query.data?.data ?? [];
  const studentCount = classes.reduce((total, item) => total + item.enrolledStudentCount, 0);
  const advisory = query.data?.advisedSection;
  return <RoleGuard allowedRoles={["TEACHER"]}>
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Teacher dashboard</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Welcome{user ? `, ${userDisplayName(user)}` : ""}</h1><p className="mt-1 text-sm text-slate-500">Your current classes and advisory assignment.</p></header>
        {query.isError ? <ErrorState title="Could not load your dashboard" error={query.error} retry={() => void query.refetch()} /> : query.isLoading ? <div className="grid animate-pulse gap-4 sm:grid-cols-3"><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-32 rounded-2xl bg-slate-200" /><div className="h-32 rounded-2xl bg-slate-200" /></div> : <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TeacherStat icon={<BookOpen size={20} />} label="Classes" value={String(classes.length)} />
            <TeacherStat icon={<Users size={20} />} label="Students across classes" value={String(studentCount)} />
            <TeacherStat icon={<Users size={20} />} label="Advisory section" value={advisory ? `Grade ${advisory.gradeLevel} · ${advisory.name}` : "None"} />
          </div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Today’s classes</h2><p className="mt-1 text-sm text-slate-500">Showing all your assigned classes.</p></div><Link href="/teacher/classes" className="text-sm font-semibold text-indigo-700 hover:underline">View all</Link></div>
            {classes.length ? <div className="divide-y divide-slate-100">{classes.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><Link href={`/teacher/classes/${item.id}`} className="min-w-48 flex-1"><p className="text-xs font-semibold uppercase text-indigo-600">{item.subject.code}</p><p className="mt-1 font-semibold text-slate-900">{item.subject.name}</p><p className="mt-1 text-sm text-slate-500">Grade {item.section.gradeLevel} · {item.section.name}</p></Link><div className="flex flex-col items-start gap-2 sm:items-end"><span className="text-sm text-slate-600">{item.enrolledStudentCount} students</span><DailyAttendanceFlag offeringId={item.id} /></div></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-slate-500">No classes assigned yet. Contact the administrator.</p>}
          </section>
        </>}
      </div>
    </DashboardLayout>
  </RoleGuard>;
}

function TeacherStat({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{icon}</span></div><p className="mt-5 text-2xl font-bold text-slate-900">{value}</p></section>;
}
