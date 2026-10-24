"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardCheck, Clock3, GraduationCap, LockKeyhole, Users } from "lucide-react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EmptyState, ErrorState } from "../../../components/shared";
import { RoleGuard } from "../../../components/RoleGuard";
import { formatRate } from "../../../features/attendance/config";
import { GradeDistributionChart } from "../../../features/dashboard/charts";
import { ContextBadge, NoSchoolYearState, SectionHeader, StatCard } from "../../../features/dashboard/components";
import { useTeacherDashboard } from "../../../features/dashboard/hooks";
import { weekdayOfDate } from "../../../lib/dates";

function TeacherDashboardContent() {
  const dashboard = useTeacherDashboard();
  const data = dashboard.data;
  const sunday = data?.context ? weekdayOfDate(data.context.today) === 0 : false;
  const firstPending = data?.attendancePending.classOfferingIds[0];
  const currentTermName = data?.context?.currentTerm?.name ?? "Current term";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SectionHeader
        eyebrow="Teacher dashboard"
        title="Your dashboard"
        description="Classes, attendance, and grade progress for your assignments."
        updatedAt={dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt) : null}
        onRefresh={() => void dashboard.refetch()}
        refreshing={dashboard.isFetching}
      />
      <ContextBadge context={data?.context ?? null} />

      {dashboard.isError && <ErrorState title="Could not load your dashboard" error={dashboard.error} retry={() => void dashboard.refetch()} />}
      {dashboard.isLoading && (
        <div className="space-y-5">
          <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">{["Classes", "Students", "Advisory", "Attendance pending today"].map((label) => <StatCard key={label} label={label} value="" loading />)}</div>
          <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      )}
      {!dashboard.isLoading && !dashboard.isError && data && (
        <>
          {!data.context && <NoSchoolYearState />}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Classes" value={data.counts.classes.toLocaleString()} icon={BookOpen} href="/teacher/classes" />
            <StatCard label="Students across classes" value={data.counts.studentsTotal.toLocaleString()} helper="Students summed across each assigned class" icon={Users} href="/teacher/classes" />
            <StatCard label="Advisory" value={data.counts.advisorySection?.label ?? "None"} helper={data.counts.advisorySection ? `${data.counts.advisorySection.students.toLocaleString()} enrolled students` : "No advisory section assigned"} icon={GraduationCap} href="/teacher/advisory/report-cards" valueClassName="text-lg" />
            <StatCard label="Attendance pending today" value={data.attendancePending.count.toLocaleString()} helper={sunday ? "Attendance actions are hidden on Sundays" : "Classes with no attendance record today"} icon={Clock3} href={firstPending ? `/teacher/classes/${firstPending}/attendance` : "/teacher/classes"} warning={data.attendancePending.count > 0} />
          </div>

          {data.context && !data.counts.classes ? (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <EmptyState title="No classes assigned yet" description="Contact the administrator if you expect to teach a class this school year." action={<Link href="/teacher/classes" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Open my classes</Link>} />
            </section>
          ) : data.context ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Today</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Attendance and current-term grade progress for each class.</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.classes.map((classItem) => (
                    <article key={classItem.classOfferingId} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1.2fr_1fr] lg:items-center">
                      <Link href={`/teacher/classes/${classItem.classOfferingId}`} className="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-indigo-600">
                        <p className="font-semibold text-slate-900 dark:text-white">{classItem.subjectName}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{classItem.sectionLabel}</p>
                        <p className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">{classItem.students.toLocaleString()} students</p>
                      </Link>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Attendance today</p>
                        {classItem.attendanceToday.recorded ? (
                          <p className="mt-1 inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} aria-hidden="true" /> Recorded · {classItem.attendanceToday.present} present, {classItem.attendanceToday.absent} absent, {classItem.attendanceToday.late} late, {classItem.attendanceToday.excused} excused</p>
                        ) : (
                          <div className="mt-1">
                            <p className="inline-flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><Clock3 size={16} aria-hidden="true" /> Not recorded yet</p>
                            {!sunday && <Link href={`/teacher/classes/${classItem.classOfferingId}/attendance`} className="ml-2 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><ClipboardCheck size={14} aria-hidden="true" /> Take attendance</Link>}
                          </div>
                        )}
                        <Link href={`/teacher/classes/${classItem.classOfferingId}/attendance/summary`} className="mt-1 inline-block text-xs text-indigo-700 hover:underline dark:text-indigo-300">Current term rate: {formatRate(classItem.attendanceRate)}</Link>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Grades · {currentTermName}</p>
                        <Link href={`/teacher/classes/${classItem.classOfferingId}/grades`} className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300">
                          {classItem.gradesCurrentTerm.graded.toLocaleString()} of {classItem.gradesCurrentTerm.expected.toLocaleString()} graded
                          {classItem.gradesCurrentTerm.locked && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LockKeyhole size={13} aria-hidden="true" /> Locked</span>}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Students to follow up</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Students with attendance below 90% in your classes this quarter.</p>
                  {data.atRisk.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <caption className="sr-only">Students flagged for attendance follow-up</caption>
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th scope="col" className="px-3 py-2">Name</th><th scope="col" className="px-3 py-2">Student no.</th><th scope="col" className="px-3 py-2">Subject</th><th scope="col" className="px-3 py-2">Rate</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{data.atRisk.map((student) => <tr key={`${student.studentId}-${student.classOfferingId}`}><td className="px-3 py-3"><Link className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300" href={`/teacher/classes/${student.classOfferingId}/attendance/summary`}>{student.name}</Link></td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{student.studentNo}</td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{student.subjectName}</td><td className="px-3 py-3"><Link className="font-semibold text-rose-700 hover:underline dark:text-rose-300" href={`/teacher/classes/${student.classOfferingId}/attendance/summary`}>{formatRate(student.rate)}</Link></td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">No students need follow-up.</p>}
                </section>
                <GradeDistributionChart data={data.gradeDistribution} />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function TeacherDashboardPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><TeacherDashboardContent /></DashboardLayout></RoleGuard>;
}
