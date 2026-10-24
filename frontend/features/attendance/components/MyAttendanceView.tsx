"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Info } from "lucide-react";
import { DataTablePagination, EmptyState, ErrorState } from "../../../components/shared";
import { formatDisplayDate, isValidDateString } from "../../../lib/dates";
import { useMyEnrollment } from "../../class-offerings/hooks";
import { formatRate } from "../config";
import { useMyAttendance } from "../hooks";
import { AttendanceStatusBadge } from "./StatusControl";

export function MyAttendanceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enrollment = useMyEnrollment();
  const fromParam = searchParams.get("from") ?? undefined;
  const toParam = searchParams.get("to") ?? undefined;
  const from = fromParam && isValidDateString(fromParam) ? fromParam : undefined;
  const to = toParam && isValidDateString(toParam) ? toParam : undefined;
  const classOfferingId = searchParams.get("classOfferingId") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") ?? "25") || 25));
  const attendance = useMyAttendance({ from, to, classOfferingId, page, pageSize });
  const offerings = useMemo(() => enrollment.data?.classOfferings ?? [], [enrollment.data?.classOfferings]);
  const dateQueryError = (fromParam && !isValidDateString(fromParam)) || (toParam && !isValidDateString(toParam));

  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in updates)) params.set("page", "1");
    router.push(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const selectedSubject = useMemo(() => offerings.find((item) => item.id === classOfferingId), [classOfferingId, offerings]);

  if (attendance.isLoading || enrollment.isLoading) return <div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-9 w-56 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /></div></div>;
  if (attendance.isError || enrollment.isError) return <ErrorState title="Could not load your attendance" error={attendance.error ?? enrollment.error} retry={() => { void attendance.refetch(); void enrollment.refetch(); }} />;

  const data = attendance.data;
  const overall = data?.summary.overall;
  const records = data?.records ?? [];
  const subjectSummaries = data?.summary.bySubject ?? [];
  const hasEnrollment = Boolean(enrollment.data?.enrollment);

  return <div className="mx-auto max-w-6xl space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student portal</p><h1 className="mt-1 text-3xl font-bold text-slate-900">My Attendance</h1><p className="mt-1 text-sm text-slate-500">Your attendance records and subject summaries.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <AttendanceStat label="Attendance rate" value={formatRate(overall?.rate ?? null)} />
      <AttendanceStat label="Present" value={String(overall?.present ?? 0)} />
      <AttendanceStat label="Absent" value={String(overall?.absent ?? 0)} />
      <AttendanceStat label="Late" value={String(overall?.late ?? 0)} />
      <AttendanceStat label="Excused" value={String(overall?.excused ?? 0)} />
    </section>
    <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />Attendance rate is (Present + Late) ÷ (Present + Late + Absent). Excused absences are not counted against you.</p>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">By subject</h2></div>
      {subjectSummaries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Excused</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Rate</th></tr></thead><tbody className="divide-y divide-slate-100">{subjectSummaries.map((item) => <tr key={item.subject.id}><td className="px-4 py-3"><p className="font-semibold text-indigo-700">{item.subject.code}</p><p className="text-slate-700">{item.subject.name}</p></td><td className="px-4 py-3">{item.present}</td><td className="px-4 py-3">{item.absent}</td><td className="px-4 py-3">{item.late}</td><td className="px-4 py-3">{item.excused}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3 font-semibold">{formatRate(item.rate)}</td></tr>)}</tbody></table></div> : <EmptyState title="No subject attendance yet" description="Attendance summaries will appear when your teachers record attendance." />}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4">
        <div className="mr-auto"><h2 className="font-semibold text-slate-900">Recent records</h2><p className="mt-1 text-sm text-slate-500">Most recent attendance records first.</p></div>
        <label className="block text-sm font-medium text-slate-600">Subject<select aria-label="Filter attendance by subject" value={classOfferingId ?? ""} onChange={(event) => updateUrl({ classOfferingId: event.target.value || null })} className="mt-1 block min-h-11 rounded-lg border border-slate-300 bg-white px-3"><option value="">All subjects</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.subject.code} · {item.subject.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-600">From<input aria-label="Filter attendance from date" type="date" value={from ?? ""} onChange={(event) => updateUrl({ from: event.target.value || null })} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" /></label>
        <label className="block text-sm font-medium text-slate-600">To<input aria-label="Filter attendance to date" type="date" value={to ?? ""} onChange={(event) => updateUrl({ to: event.target.value || null })} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" /></label>
      </div>
      {dateQueryError && <p className="m-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">A date filter in the URL is invalid. Choose a valid date to apply it.</p>}
      {attendance.isFetching && !attendance.isLoading && <p className="px-5 py-2 text-xs text-slate-500" role="status">Updating attendance…</p>}
      {records.length ? <>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Remarks</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map((record, index) => <tr key={`${record.date}-${record.subject.id}-${index}`}><td className="px-4 py-3 whitespace-nowrap">{formatDisplayDate(record.date)}</td><td className="px-4 py-3"><span className="font-semibold">{record.subject.code}</span><span className="ml-2 text-slate-600">{record.subject.name}</span></td><td className="px-4 py-3"><AttendanceStatusBadge status={record.status} /></td><td className="px-4 py-3 text-slate-600">{record.remarks || "—"}</td></tr>)}</tbody></table></div>
        {data?.pagination && <DataTablePagination page={data.pagination.page} pageSize={data.pagination.pageSize} total={data.pagination.total} totalPages={data.pagination.totalPages} onPage={(nextPage) => updateUrl({ page: String(nextPage) })} onPageSize={(nextSize) => updateUrl({ pageSize: String(nextSize), page: "1" })} />}
      </> : hasEnrollment ? <EmptyState title="No attendance has been recorded yet" description={selectedSubject ? `No attendance records for ${selectedSubject.subject.name} in this date range.` : "Your recent attendance records will appear here after a teacher saves the class sheet."} /> : <EmptyState title="You are not enrolled for the current school year" description="Please contact the registrar to confirm your enrollment." action={<Link href="/student/subjects" className="text-sm font-semibold text-indigo-700 hover:underline">View my subjects</Link>} />}
    </section>
    <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={15} aria-hidden="true" />{data ? `Showing ${formatDisplayDate(data.from)} – ${formatDisplayDate(data.to)}` : ""}</p>
  </div>;
}

function AttendanceStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p></article>;
}
