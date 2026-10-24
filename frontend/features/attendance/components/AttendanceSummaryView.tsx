"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, CalendarDays, Info, TriangleAlert } from "lucide-react";
import { EmptyState, ErrorState } from "../../../components/shared";
import { formatDisplayDate, isValidDateString, manilaToday } from "../../../lib/dates";
import { useCurrentSchoolYear } from "../../school-years/hooks";
import { useClassOffering } from "../../class-offerings/hooks";
import { useAttendanceDates, useAttendanceSummary } from "../hooks";
import { formatRate } from "../config";
import type { AttendanceSummaryStudent } from "../../../types/attendance";
import { useAuth } from "../../../providers/AuthProvider";

type SortField = "name" | "rate";

export function AttendanceSummaryView({ offeringId }: Readonly<{ offeringId: string }>) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const schoolYear = useCurrentSchoolYear();
  const offering = useClassOffering(offeringId);
  const today = manilaToday();
  const defaultFrom = schoolYear.data?.data.startDate.slice(0, 10) ?? today;
  const fromQuery = searchParams.get("from");
  const toQuery = searchParams.get("to");
  const from = fromQuery && isValidDateString(fromQuery) ? fromQuery : defaultFrom;
  const to = toQuery && isValidDateString(toQuery) ? toQuery : today;
  const summary = useAttendanceSummary(offeringId, from, to);
  const [month, setMonth] = useState(to.slice(0, 7));
  const dates = useAttendanceDates(offeringId, month);
  const [sortField, setSortField] = useState<SortField>("name");
  const [descending, setDescending] = useState(false);

  useEffect(() => {
    if (fromQuery === from && toQuery === to) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", from);
    next.set("to", to);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [from, fromQuery, pathname, router, searchParams, to, toQuery]);

  function updateRange(key: "from" | "to", value: string) {
    if (!isValidDateString(value)) return;
    const nextFrom = key === "from" ? value : from;
    const nextTo = key === "to" ? value : to;
    if (nextFrom > nextTo) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", nextFrom);
    next.set("to", nextTo);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const sorted = useMemo(() => {
    const values = [...(summary.data?.students ?? [])];
    values.sort((left, right) => {
      const result = sortField === "name"
        ? `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`)
        : (left.rate ?? -1) - (right.rate ?? -1);
      return descending ? -result : result;
    });
    return values;
  }, [descending, sortField, summary.data?.students]);

  if (offering.error && "status" in offering.error && (offering.error.status === 403 || offering.error.status === 404)) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h1 className="text-xl font-semibold">You don’t have access to this class</h1><Link href="/teacher/classes" className="mt-4 inline-block text-sm font-semibold text-indigo-700">Back to classes</Link></div>;
  }
  if (offering.isLoading || (schoolYear.isLoading && !fromQuery)) return <div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-8 w-64 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-4"><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /></div></div>;
  if (summary.isError || offering.isError || !offering.data) return <ErrorState title="Could not load class attendance summary" error={summary.error ?? offering.error} retry={() => { void summary.refetch(); void offering.refetch(); }} />;

  const item = offering.data;
  const classBackHref = user?.role === "ADMIN" ? `/admin/sections/${item.section.id}` : `/teacher/classes/${offeringId}`;
  const overall = summary.data?.overall;
  const recordedDates = dates.data?.dates ?? [];
  const sortedDates = [...recordedDates].sort((a, b) => b.date.localeCompare(a.date));

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href={classBackHref} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={16} /> Back to class</Link><p className="mt-4 text-sm font-semibold uppercase tracking-wide text-indigo-600">{item.subject.code}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Attendance summary · {item.subject.name}</h1><p className="mt-1 text-slate-600">Grade {item.section.gradeLevel} · {item.section.name}</p></div>
      <Link href={`/teacher/classes/${offeringId}/attendance`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Daily sheet</Link>
    </header>
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">From</span><input type="date" max={to} value={from} onChange={(event) => updateRange("from", event.target.value)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" /></label>
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</span><input type="date" min={from} max={today} value={to} onChange={(event) => updateRange("to", event.target.value)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" /></label>
      <p className="basis-full text-sm text-slate-500">Date range is kept in the URL.</p>
    </section>
    {summary.data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryStat label="Days recorded" value={String(overall?.recordedDates ?? 0)} />
      <SummaryStat label="Overall attendance rate" value={formatRate(overall?.rate ?? null)} />
      <SummaryStat label="Total absences" value={String(overall?.absent ?? 0)} />
      <SummaryStat label="Total lates" value={String(overall?.late ?? 0)} />
    </div>}
    <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"><Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />Attendance rate is (Present + Late) ÷ (Present + Late + Absent). Excused absences are not counted against the student.</p>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Student attendance</h2><p className="mt-1 text-sm text-slate-500">{formatDisplayDate(from)} – {formatDisplayDate(to)}</p></div><button type="button" onClick={() => { setSortField(sortField === "name" ? "rate" : "name"); setDescending(false); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium"><ArrowUpDown size={15} />Sort by {sortField === "name" ? "rate" : "name"}</button></div>
      {summary.isLoading ? <div className="h-72 animate-pulse bg-slate-100" /> : sorted.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
        <th className="px-4 py-3"><button type="button" onClick={() => { setSortField("name"); setDescending(!descending); }} className="inline-flex items-center gap-1">Student <ArrowUpDown size={13} /></button></th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Absent</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Excused</th><th className="px-4 py-3">Total</th><th className="px-4 py-3"><button type="button" onClick={() => { setSortField("rate"); setDescending(!descending); }} className="inline-flex items-center gap-1">Rate <ArrowUpDown size={13} /></button></th>
      </tr></thead><tbody className="divide-y divide-slate-100">{sorted.map((student) => <SummaryRow key={student.id} student={student} />)}</tbody></table></div> : <EmptyState title="No students enrolled in this class yet" description="Student attendance summaries will appear here when the roster is populated." />}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><CalendarDays size={18} className="text-indigo-600" />Recorded dates</h2><p className="mt-1 text-sm text-slate-500">Select a date to open that daily sheet.</p></div><label className="block text-sm font-medium text-slate-600">Month<input aria-label="Recorded dates month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block min-h-10 rounded-lg border border-slate-300 px-3" /></label></div>
      {dates.isError ? <div className="p-5 text-sm text-rose-700" role="alert">Could not load recorded dates. <button type="button" onClick={() => void dates.refetch()} className="font-semibold underline">Retry</button></div> : dates.isLoading ? <div className="h-24 animate-pulse bg-slate-100" /> : sortedDates.length ? <ul className="divide-y divide-slate-100">{sortedDates.map((entry) => <li key={entry.date} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><Link href={`/teacher/classes/${offeringId}/attendance?date=${entry.date}`} className="font-semibold text-indigo-700 hover:underline">{formatDisplayDate(entry.date)}</Link><p className="mt-1 text-xs text-slate-500">{entry.total} marked · {entry.present} present · {entry.absent} absent · {entry.late} late · {entry.excused} excused</p></div><Link href={`/teacher/classes/${offeringId}/attendance?date=${entry.date}`} aria-label={`Open attendance sheet for ${formatDisplayDate(entry.date)}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open sheet</Link></li>)}</ul> : <EmptyState title="No attendance recorded this month" description="Choose another month or take attendance from the daily sheet." />}
    </section>
  </div>;
}

function SummaryStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold text-slate-900">{value}</p></article>;
}

function SummaryRow({ student }: Readonly<{ student: AttendanceSummaryStudent }>) {
  const low = student.rate !== null && student.rate < 90;
  return <tr>
    <td className="px-4 py-3"><span className="font-medium text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</span><p className="text-xs text-slate-500">{student.studentNo}</p>{low && <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-700"><TriangleAlert size={13} aria-hidden="true" />Below 90%</span>}</td>
    <td className="px-4 py-3">{student.present}</td><td className="px-4 py-3">{student.absent}</td><td className="px-4 py-3">{student.late}</td><td className="px-4 py-3">{student.excused}</td><td className="px-4 py-3">{student.total}</td>
    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="w-14 font-semibold">{formatRate(student.rate)}</span>{student.rate !== null && <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Attendance rate for ${student.firstName} ${student.lastName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={student.rate}><div className={`h-full ${low ? "bg-rose-600" : "bg-emerald-600"}`} style={{ width: `${Math.max(0, Math.min(student.rate, 100))}%` }} /></div>}</div></td>
  </tr>;
}
