"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, FileText, GraduationCap, XCircle } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EmptyState, ErrorState, StatusBadge } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { formatRate, STATUS_CONFIG } from "../../../features/attendance/config";
import { ContextBadge, NoSchoolYearState, SectionHeader, StatCard } from "../../../features/dashboard/components";
import { useStudentDashboard } from "../../../features/dashboard/hooks";
import { formatDisplayDate } from "../../../lib/dates";
import { useAuth } from "../../../providers/AuthProvider";
import { userDisplayName } from "../../../lib/auth";

function GradeBadge({ score }: Readonly<{ score: number }>) {
  const passing = score >= 75;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${passing ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
      {passing ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
      {score.toFixed(2)} · {passing ? "Passing" : "Below 75"}
    </span>
  );
}

function StudentDashboardContent() {
  const { user } = useAuth();
  const dashboard = useStudentDashboard();
  const data = dashboard.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SectionHeader
        eyebrow="Student dashboard"
        title={`Welcome${user ? `, ${userDisplayName(user)}` : ""}`}
        description="Your enrollment, released grades, and attendance."
        updatedAt={dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt) : null}
        onRefresh={() => void dashboard.refetch()}
        refreshing={dashboard.isFetching}
      />
      <ContextBadge context={data?.context ?? null} />

      {dashboard.isError && <ErrorState title="Could not load your dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}
      {dashboard.isLoading && (
        <div className="space-y-5">
          <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">{["Section and adviser", "Attendance rate", "General average", "Report card"].map((label) => <StatCard key={label} label={label} value="" loading />)}</div>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {!dashboard.isLoading && !dashboard.isError && data && (
        <>
          {!data.context && <NoSchoolYearState />}
          {!data.enrollment && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <EmptyState title="You are not enrolled yet" description="Your school-year dashboard will be available after the registrar completes your enrollment." action={<Link href="/student/subjects" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View my subjects</Link>} />
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Section and adviser"
              value={data.enrollment?.sectionLabel ?? "Not enrolled"}
              helper={data.enrollment?.adviserName ? `Adviser: ${data.enrollment.adviserName}` : "Adviser not assigned"}
              icon={GraduationCap}
              href="/student/subjects"
              valueClassName="text-lg"
            />
            <StatCard
              label="Attendance rate this school year"
              value={formatRate(data.attendance.overallRate)}
              helper={`Current term: ${formatRate(data.attendance.currentTermRate)}`}
              icon={ClipboardCheck}
              href="/student/attendance"
            />
            <Link href="/student/grades" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">General average</p><BookOpen size={19} className="text-indigo-700 dark:text-indigo-300" aria-hidden="true" /></div>
                <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{data.grades.generalAverage === null ? "No released grades yet" : `${data.grades.generalAverage.toFixed(2)}%`}</p>
                {data.grades.generalAverage !== null && <div className="mt-2"><GradeBadge score={data.grades.generalAverage} /></div>}
                {data.grades.latestReleasedTerm && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Latest released: {data.grades.latestReleasedTerm.name} · {data.grades.latestReleasedTerm.average === null ? "No scores" : `${data.grades.latestReleasedTerm.average.toFixed(2)}%`}</p>}
              </div>
            </Link>
            {data.reportCardAvailable ? (
              <Link href="/student/report-card" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report card</p><FileText size={19} className="text-indigo-700 dark:text-indigo-300" aria-hidden="true" /></div>
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">View report card</p>
                  <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"><FileText size={15} aria-hidden="true" /> Open</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report card</p><FileText size={19} className="text-slate-400" aria-hidden="true" /></div>
                <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Not available</p>
                <button type="button" disabled aria-describedby="report-card-unavailable-reason" className="mt-2 cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Open</button>
                <p id="report-card-unavailable-reason" className="mt-2 text-xs text-slate-500 dark:text-slate-400">A report card will be available after enrollment.</p>
              </div>
            )}
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900 dark:text-white">Recent absences and lates</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your five most recent records that need attention.</p></div>
                <Link href="/student/attendance" className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Attendance details</Link>
              </div>
              {data.attendance.recentAbsences.length ? (
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
                  {data.attendance.recentAbsences.map((record, index) => {
                    const status = STATUS_CONFIG[record.status];
                    const Icon = status.icon;
                    return (
                      <li key={`${record.date}-${record.subjectName}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <Link href="/student/attendance" className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300">{record.subjectName}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDisplayDate(record.date)}</p>
                        </Link>
                        <Link href="/student/attendance" aria-label={`${status.label} attendance record for ${record.subjectName} on ${formatDisplayDate(record.date)}`} className="inline-flex items-center gap-1.5">
                          <Icon size={16} aria-hidden="true" className={record.status === "ABSENT" ? "text-rose-700" : "text-amber-700"} />
                          <StatusBadge label={status.label} color={record.status === "ABSENT" ? "red" : "yellow"} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">No recent absences.</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900 dark:text-white">Grades overview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><Link href="/student/grades" className="hover:text-indigo-700 hover:underline dark:hover:text-indigo-300">Released terms: {data.grades.releasedTerms.toLocaleString()}</Link></p></div>
                <Link href="/student/grades" className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View my grades</Link>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Only released grades are shown.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link href="/student/grades" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-emerald-800 dark:bg-emerald-950">
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200"><CheckCircle2 size={16} aria-hidden="true" /> Subjects passed</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{data.grades.subjectsPassed.toLocaleString()}</p>
                </Link>
                <Link href="/student/grades" className="rounded-xl border border-rose-200 bg-rose-50 p-4 focus-visible:outline-2 focus-visible:outline-rose-700 dark:border-rose-800 dark:bg-rose-950">
                  <p className="flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-200"><XCircle size={16} aria-hidden="true" /> Subjects below 75</p>
                  <p className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-100">{data.grades.subjectsBelowPassing.toLocaleString()}</p>
                </Link>
              </div>
              {!data.grades.releasedTerms && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><CalendarDays size={16} aria-hidden="true" /> Grades will appear after a term is released.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  return <RoleGuard allowedRoles={["STUDENT"]}><DashboardLayout><StudentDashboardContent /></DashboardLayout></RoleGuard>;
}
