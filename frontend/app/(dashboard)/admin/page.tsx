"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
  School,
  Users,
  UserX,
} from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EmptyState, ErrorState } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { userDisplayName } from "../../../lib/auth";
import { useAuth } from "../../../providers/AuthProvider";
import {
  AllClear,
  AttentionItem,
  ContextBadge,
  NoSchoolYearState,
  ProgressPanel,
  SectionHeader,
  StatCard,
} from "../../../features/dashboard/components";
import { AttendanceTrendChart, EnrollmentChart, SectionSizesChart } from "../../../features/dashboard/charts";
import { useAdminDashboard } from "../../../features/dashboard/hooks";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created a record",
  UPDATE: "Updated a record",
  STATUS_CHANGE: "Changed a status",
  ENROLL: "Enrolled a student",
  TRANSFER: "Transferred a student",
  ATTENDANCE_SAVE: "Saved attendance",
  GRADES_SAVE: "Saved grades",
  GRADE_CHANGE: "Changed a grade",
  TERM_LOCK: "Locked a term",
  TERM_UNLOCK: "Unlocked a term",
  LOGIN: "Signed in",
  REPORT_CARD_VIEW: "Viewed a report card",
};

function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  const minutes = Math.round((time - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const dashboard = useAdminDashboard();
  const data = dashboard.data;
  const lockedRate = data?.gradeProgress.expectedEntries
    ? Math.min(100, data.gradeProgress.percentComplete)
    : 0;
  const activity = data?.recentActivity ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SectionHeader
        eyebrow="Admin dashboard"
        title={`Welcome${user ? `, ${userDisplayName(user)}` : ""}`}
        description="A live overview of enrollment, attendance, and grading."
        updatedAt={dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt) : null}
        onRefresh={() => void dashboard.refetch()}
        refreshing={dashboard.isFetching}
      />
      <ContextBadge context={data?.context ?? null} />

      {dashboard.isError && <ErrorState title="Could not load the admin dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}

      {!dashboard.isError && (
        <>
          {dashboard.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {["Enrolled students", "Active teachers", "Sections", "Class offerings", "Unassigned students"].map((label) => <StatCard key={label} label={label} value="" loading />)}
            </div>
          ) : data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Enrolled students" value={data.counts.enrolledStudents.toLocaleString()} helper={`of ${data.counts.activeStudents.toLocaleString()} active`} icon={Users} href="/admin/students" />
              <StatCard label="Active teachers" value={data.counts.activeTeachers.toLocaleString()} icon={GraduationCap} href="/admin/teachers" />
              <StatCard label="Sections" value={data.counts.sections.toLocaleString()} icon={School} href="/admin/sections" />
              <StatCard label="Class offerings" value={data.counts.classOfferings.toLocaleString()} icon={BookOpen} href="/admin/sections" />
              <StatCard label="Unassigned students" value={data.counts.unassignedStudents.toLocaleString()} helper="Active students without enrollment" icon={UserX} href="/admin/enrollment" warning={data.counts.unassignedStudents > 0} />
            </div>
          ) : null}

          {!dashboard.isLoading && data && !data.context && <NoSchoolYearState admin />}

          {dashboard.isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {["Needs attention", "Recent activity"].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)}
            </div>
          ) : data && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2"><Activity size={18} className="text-amber-600" aria-hidden="true" /><h2 className="font-semibold text-slate-900 dark:text-white">Needs attention</h2></div>
                {data.needsAttention.length ? (
                  <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                    {data.needsAttention.map((item) => <AttentionItem key={item.id} {...item} />)}
                  </ul>
                ) : <AllClear />}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900 dark:text-white">Recent activity</h2><Link href="/admin" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Latest 10</Link></div>
                {/* TODO: A full audit log viewer comes in a later phase. */}
                {activity.length ? (
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
                    {activity.map((item) => (
                      <li key={item.id} className="py-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ACTION_LABELS[item.action] ?? item.action.replaceAll("_", " ").toLowerCase()} <span className="font-normal text-slate-500">· {item.entity}</span></p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.actor ? `${item.actor.email} · ${item.actor.role}` : "System"}</span>
                          <time dateTime={item.createdAt} title={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(item.createdAt))}>{relativeTime(item.createdAt)}</time>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No recent activity" description="Administrative activity will appear here." />}
              </section>
            </div>
          )}

          {dashboard.isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 lg:col-span-2" /></div>
          ) : data?.context ? (
            <>
              <div className="grid gap-5 xl:grid-cols-2">
                <EnrollmentChart data={data.enrollmentByGrade} />
                <AttendanceTrendChart data={data.attendanceTrend} />
              </div>
              <SectionSizesChart data={data.sectionSizes} />
              <div className="grid gap-5 md:grid-cols-2">
                <ProgressPanel
                  title="Attendance today"
                  value={data.attendanceToday.classesExpected
                    ? Math.round((data.attendanceToday.classesWithRecords / data.attendanceToday.classesExpected) * 100)
                    : 0}
                  helper={`${data.attendanceToday.classesWithRecords.toLocaleString()} of ${data.attendanceToday.classesExpected.toLocaleString()} classes with records · rate ${data.attendanceToday.rate === null ? "N/A" : `${data.attendanceToday.rate.toFixed(1)}%`}`}
                  href="/admin/sections"
                />
                <ProgressPanel
                  title={`Grades for ${data.context.currentTerm?.name ?? "current term"}`}
                  value={lockedRate}
                  helper={`${data.gradeProgress.gradedEntries.toLocaleString()} of ${data.gradeProgress.expectedEntries.toLocaleString()} entries · ${data.gradeProgress.incompleteClasses.toLocaleString()} incomplete classes`}
                  href="/admin/school-years"
                  badge={data.gradeProgress.locked ? "Locked" : "Open"}
                  icon={data.gradeProgress.locked ? LockKeyhole : CheckCircle2}
                />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><AdminDashboardContent /></DashboardLayout></RoleGuard>;
}
