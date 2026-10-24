"use client";

import { STATUS_CONFIG, ATTENDANCE_STATUSES } from "../config";
import type { AttendanceStatus } from "../../../types/attendance";

export function StatusControl({
  value,
  studentName,
  onChange,
}: Readonly<{
  value: AttendanceStatus;
  studentName: string;
  onChange: (status: AttendanceStatus) => void;
}>) {
  return <div role="group" aria-label={`Attendance status for ${studentName}`} className="inline-flex flex-wrap gap-2">
    {ATTENDANCE_STATUSES.map((status) => {
      const config = STATUS_CONFIG[status];
      const Icon = config.icon;
      const active = value === status;
      return <button
        key={status}
        type="button"
        aria-label={`Mark ${studentName} as ${config.label}`}
        aria-pressed={active}
        onClick={() => onChange(status)}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${active ? config.classes : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
      >
        <Icon size={16} aria-hidden="true" /><span>{config.short}</span><span className="sr-only">{config.label}</span>
      </button>;
    })}
  </div>;
}

export function AttendanceStatusBadge({ status }: Readonly<{ status: AttendanceStatus | null }>) {
  if (!status) return <span className="text-sm text-slate-500">Not recorded</span>;
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.classes}`}>
    <Icon size={14} aria-hidden="true" />{config.label}
  </span>;
}
