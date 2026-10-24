"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Search, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, ErrorState } from "../../../components/shared";
import { ApiError } from "../../../lib/api";
import { addDays, formatDisplayDate, isValidDateString, manilaToday, weekdayOfDate } from "../../../lib/dates";
import type { AttendanceStatus } from "../../../types/attendance";
import { useClassOffering } from "../../class-offerings/hooks";
import { useAttendanceSheet, useSaveAttendance } from "../hooks";
import { STATUS_CONFIG } from "../config";
import { AttendanceStatusBadge, StatusControl } from "./StatusControl";
import { useAuth } from "../../../providers/AuthProvider";

type Draft = Record<string, { status: AttendanceStatus; remarks: string }>;
const EMPTY_ROSTER: NonNullable<ReturnType<typeof useAttendanceSheet>["data"]>["roster"] = [];

function initialDraft(roster: NonNullable<ReturnType<typeof useAttendanceSheet>["data"]>["roster"]): Draft {
  return Object.fromEntries(roster.map((student) => [student.studentId, {
    status: student.status ?? "PRESENT",
    remarks: student.remarks ?? "",
  }]));
}

function friendlySaveError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Could not save attendance. Please try again.";
  switch (error.code) {
    case "FUTURE_DATE": return "Attendance cannot be recorded for a future date.";
    case "OUTSIDE_SCHOOL_YEAR": return "This date is outside the class school year.";
    case "EDIT_WINDOW_CLOSED": return "The edit window has closed. Ask an administrator to correct attendance for this date.";
    case "STUDENT_NOT_IN_CLASS": return "The class roster has changed. Refresh the roster and try again.";
    default: return error.status === 403 ? "You don't have access to edit this class." : error.message;
  }
}

export function AttendanceSheetView({ offeringId }: Readonly<{ offeringId: string }>) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = manilaToday();
  const queryDate = searchParams.get("date");
  const date = queryDate && isValidDateString(queryDate) ? queryDate : today;
  const sheet = useAttendanceSheet(offeringId, date);
  const offering = useClassOffering(offeringId);
  const save = useSaveAttendance(offeringId);
  const [draftState, setDraftState] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [savedAnnouncement, setSavedAnnouncement] = useState("");

  useEffect(() => {
    if (queryDate === date) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [date, pathname, queryDate, router, searchParams]);

  const roster = sheet.data?.roster ?? EMPTY_ROSTER;
  const initial = useMemo(() => initialDraft(roster), [roster]);
  const draft = draftState ?? initial;
  const dirty = useMemo(() => {
    if (!sheet.data) return false;
    return roster.some((student) => {
      const value = draft[student.studentId];
      return !value || value.status !== (student.status ?? "PRESENT") || value.remarks !== (student.remarks ?? "");
    });
  }, [draft, roster, sheet.data]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const interceptLink = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      setPendingNavigation(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", interceptLink, true);
    return () => document.removeEventListener("click", interceptLink, true);
  }, [dirty]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return roster;
    return roster.filter((student) =>
      `${student.studentNo} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`.toLocaleLowerCase().includes(term),
    );
  }, [roster, search]);

  const counts = useMemo(() => {
    const value = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const student of roster) value[draft[student.studentId]?.status ?? "PRESENT"] += 1;
    return value;
  }, [draft, roster]);

  const setDateInUrl = useCallback((nextDate: string) => {
    setDraftState(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", nextDate);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  function requestDateChange(nextDate: string) {
    if (!isValidDateString(nextDate) || nextDate > today || nextDate === date) return;
    if (dirty) setPendingDate(nextDate);
    else setDateInUrl(nextDate);
  }

  function markAllPresent() {
    setDraftState(Object.fromEntries(roster.map((student) => [
      student.studentId,
      { status: "PRESENT" as const, remarks: "" },
    ])));
  }

  async function saveDraft() {
    try {
      const result = await save.mutateAsync({
        date,
        records: roster.map((student) => ({
          studentId: student.studentId,
          status: draft[student.studentId]?.status ?? "PRESENT",
          remarks: draft[student.studentId]?.remarks.trim() ?? "",
        })),
      });
      setDraftState(null);
      const announcement = `Attendance saved: ${result.summary.present} present, ${result.summary.absent} absent, ${result.summary.late} late, ${result.summary.excused} excused`;
      setSavedAnnouncement(announcement);
      toast.success(announcement);
    } catch (error) {
      toast.error(friendlySaveError(error));
    }
  }

  const isAccessError = [sheet.error, offering.error].some((error) =>
    error instanceof ApiError && (error.status === 403 || error.status === 404),
  );

  if (isAccessError) return <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
    <h1 className="text-xl font-semibold text-slate-900">You don’t have access to this class</h1>
    <p className="mt-2 text-sm text-slate-500">The class may not exist or may not be assigned to your account.</p>
    <Link href="/teacher/classes" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft size={16} /> Back to classes</Link>
  </div>;

  if (sheet.isLoading || offering.isLoading) return <div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-8 w-56 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>;
  if (sheet.isError || offering.isError || !offering.data) {
    return <ErrorState title="Could not load the attendance sheet" error={sheet.error ?? offering.error} retry={() => { void sheet.refetch(); void offering.refetch(); }} />;
  }
  if (!sheet.data) return <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />;

  const item = offering.data;
  const sheetData = sheet.data;
  const classBackHref = user?.role === "ADMIN" ? `/admin/sections/${item.section.id}` : `/teacher/classes/${offeringId}`;
  const weekday = weekdayOfDate(date);
  const statusTotals = Object.entries(STATUS_CONFIG) as Array<[AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]]>;
  const doLeave = () => {
    setDraftState(null);
    if (pendingDate) {
      setDateInUrl(pendingDate);
      setPendingDate(null);
    } else if (pendingNavigation) {
      const next = pendingNavigation;
      setPendingNavigation(null);
      router.push(next);
    }
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link href={classBackHref} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={16} /> Back to class</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-indigo-600">{item.subject.code}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Attendance · {item.subject.name}</h1>
        <p className="mt-1 text-slate-600">Grade {item.section.gradeLevel} · {item.section.name}</p>
      </div>
      <Link href={`/teacher/classes/${offeringId}/attendance/summary`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Attendance summary</Link>
    </header>

    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance date</span><input aria-label="Attendance date" type="date" max={today} value={date} onChange={(event) => requestDateChange(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" /></label>
      <button type="button" aria-label="Previous day" onClick={() => requestDateChange(addDays(date, -1))} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"><ArrowLeft size={16} /> Previous</button>
      <button type="button" aria-label="Next day" disabled={date >= today} onClick={() => requestDateChange(addDays(date, 1))} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight size={16} /> Next</button>
      <button type="button" disabled={date === today} onClick={() => requestDateChange(today)} className="min-h-11 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">Today</button>
      <p className="flex basis-full items-center gap-2 text-sm text-slate-600 sm:basis-auto"><CalendarDays size={16} aria-hidden="true" />{formatDisplayDate(date)}</p>
    </section>
    {(weekday === 0 || weekday === 6) && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">Weekend: is there a class today?</p>}

    {!sheetData.recorded && <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status">This date has not been recorded yet. Draft students default to Present until you save.</p>}
    {!sheetData.editable && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">This date can no longer be edited. Ask an administrator to make a correction.</p>}
    {sheetData.editable && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={markAllPresent} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Check size={16} /> Mark all present</button>
          <label className="relative block w-full sm:w-64"><span className="sr-only">Search students</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roster" className="min-h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" /></label>
        </div>
        <button type="button" disabled={!dirty || save.isPending} onClick={() => void saveDraft()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} />{save.isPending ? "Saving…" : "Save attendance"}</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{savedAnnouncement}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite" aria-atomic="true">
        {statusTotals.map(([status, config]) => {
          const Icon = config.icon;
          return <div key={status} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${config.classes}`}><Icon size={17} aria-hidden="true" /><span>{config.label}: {counts[status]}</span></div>;
        })}
      </div>

      {!roster.length ? <EmptyState title="No students are enrolled in this class yet" description="The attendance sheet will be available after students are enrolled." /> : !filtered.length ? <EmptyState title="No students match your search" description="Try searching by another name or student number." /> : <>
        <div className="space-y-3 md:hidden">
          {filtered.map((student, index) => {
            const value = draft[student.studentId] ?? { status: "PRESENT" as const, remarks: "" };
            const displayName = `${student.firstName} ${student.middleName ? `${student.middleName} ` : ""}${student.lastName}`;
            return <article key={student.studentId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">#{index + 1} · {student.studentNo}</p><h2 className="mt-1 font-semibold text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</h2></div><Users size={17} className="text-slate-400" aria-hidden="true" /></div>
              {sheetData.editable ? <div className="mt-4 space-y-3"><StatusControl value={value.status} studentName={displayName} onChange={(status) => setDraftState((current) => ({ ...(current ?? initial), [student.studentId]: { ...value, status, remarks: status === "PRESENT" ? "" : value.remarks } }))} />{value.status !== "PRESENT" && <RemarksInput studentId={student.studentId} value={value.remarks} onChange={(remarks) => setDraftState((current) => ({ ...(current ?? initial), [student.studentId]: { ...value, remarks } }))} />}</div> : <div className="mt-3"><AttendanceStatusBadge status={student.status} />{student.remarks && <p className="mt-2 text-sm text-slate-600">{student.remarks}</p>}</div>}
            </article>;
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Student No</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Remarks</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{filtered.map((student, index) => {
              const value = draft[student.studentId] ?? { status: "PRESENT" as const, remarks: "" };
              const displayName = `${student.firstName} ${student.middleName ? `${student.middleName} ` : ""}${student.lastName}`;
              return <tr key={student.studentId}>
                <td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-medium">{student.studentNo}</td><td className="px-4 py-3 font-medium text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</td>
                <td className="px-4 py-3">{sheetData.editable ? <StatusControl value={value.status} studentName={displayName} onChange={(status) => setDraftState((current) => ({ ...(current ?? initial), [student.studentId]: { ...value, status, remarks: status === "PRESENT" ? "" : value.remarks } }))} /> : <AttendanceStatusBadge status={student.status} />}</td>
                <td className="px-4 py-3">{sheetData.editable && value.status !== "PRESENT" ? <RemarksInput studentId={student.studentId} value={value.remarks} onChange={(remarks) => setDraftState((current) => ({ ...(current ?? initial), [student.studentId]: { ...value, remarks } }))} /> : !sheetData.editable ? <span className="text-slate-600">{student.remarks || "—"}</span> : <span className="text-slate-400">—</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
    </section>}
    {!sheetData.editable && roster.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Saved attendance</h2></div><div className="divide-y divide-slate-100">{filtered.map((student) => <div key={student.studentId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="font-medium text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</p><p className="text-xs text-slate-500">{student.studentNo}</p></div><AttendanceStatusBadge status={student.status} /></div>)}</div></section>}

    {(pendingDate || pendingNavigation) && <ConfirmDialog title="Discard unsaved attendance?" description="Your changes have not been saved. Continue and discard them?" confirmLabel="Discard changes" destructive onConfirm={doLeave} onClose={() => { setPendingDate(null); setPendingNavigation(null); }} />}
  </div>;
}

function RemarksInput({ studentId, value, onChange }: Readonly<{ studentId: string; value: string; onChange: (value: string) => void }>) {
  return <input aria-label={`Remarks for student ${studentId}`} maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Optional remarks" className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />;
}
