"use client";

import Link from "next/link";
import { useAttendanceSheet } from "../hooks";
import { manilaToday } from "../../../lib/dates";

export function DailyAttendanceFlag({ offeringId }: Readonly<{ offeringId: string }>) {
  const query = useAttendanceSheet(offeringId, manilaToday());
  if (query.isLoading) return <span className="text-xs text-slate-400" role="status">Checking today’s attendance…</span>;
  if (query.isError) return <span className="text-xs text-rose-700">Attendance status unavailable</span>;
  if (!query.data) return <span className="text-xs text-slate-400">Attendance status unavailable</span>;
  if (query.data.recorded) return <span className="text-xs font-medium text-emerald-700">Today’s attendance recorded</span>;
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">No attendance recorded today
    <Link href={`/teacher/classes/${offeringId}/attendance`} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900 hover:bg-amber-100">Take attendance</Link>
  </span>;
}
