import { CircleCheck, Clock3, FileQuestion, XCircle, type LucideIcon } from "lucide-react";
import type { AttendanceStatus } from "../../types/attendance";

export const STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  short: string;
  icon: LucideIcon;
  classes: string;
}> = {
  PRESENT: { label: "Present", short: "P", icon: CircleCheck, classes: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  ABSENT: { label: "Absent", short: "A", icon: XCircle, classes: "border-rose-300 bg-rose-50 text-rose-800" },
  LATE: { label: "Late", short: "L", icon: Clock3, classes: "border-amber-300 bg-amber-50 text-amber-900" },
  EXCUSED: { label: "Excused", short: "E", icon: FileQuestion, classes: "border-sky-300 bg-sky-50 text-sky-800" },
};

export const ATTENDANCE_STATUSES = Object.keys(STATUS_CONFIG) as AttendanceStatus[];

export function formatRate(rate: number | null): string {
  return rate === null ? "N/A" : `${rate.toFixed(1)}%`;
}
