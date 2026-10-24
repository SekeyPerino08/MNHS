import { Role } from "@prisma/client";
import { AppError } from "../../utils/AppError.js";
import {
  formatDateString,
  parseDateString,
  TEACHER_EDIT_WINDOW_DAYS,
  todayInManila,
} from "../../utils/dates.js";

export interface AttendanceUser {
  role: Role;
}

export interface AttendanceSchoolYear {
  startDate: Date | string;
  endDate: Date | string;
}

export function canEditAttendance(
  user: AttendanceUser,
  date: string,
  schoolYear: AttendanceSchoolYear,
  today = todayInManila(),
): boolean {
  const dateValue = parseDateString(date);
  const todayValue = parseDateString(today);
  const start = parseDateString(formatDateString(schoolYear.startDate));
  const end = parseDateString(formatDateString(schoolYear.endDate));

  if (dateValue > todayValue) throw new AppError("Attendance cannot be recorded for a future date", 400, "FUTURE_DATE");
  if (dateValue < start || dateValue > end) {
    throw new AppError("Attendance date must be within the school year", 400, "OUTSIDE_SCHOOL_YEAR");
  }
  if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  // Weekends remain valid because some schools hold Saturday classes; the UI can warn about them.
  if (user.role === Role.TEACHER) {
    const daysAgo = Math.floor((todayValue.getTime() - dateValue.getTime()) / 86_400_000);
    if (daysAgo >= TEACHER_EDIT_WINDOW_DAYS) {
      throw new AppError(
        "The teacher attendance edit window is closed. Please ask an administrator to update this date.",
        403,
        "EDIT_WINDOW_CLOSED",
      );
    }
  }
  return true;
}

export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  excused: number;
}

/** Calculates attendance percentage; EXCUSED records are excluded from the denominator. */
export function calculateAttendanceRate(counts: AttendanceCounts): number | null {
  const denominator = counts.present + counts.late + counts.absent;
  if (denominator === 0) return null;
  return Math.round(((counts.present + counts.late) / denominator) * 1000) / 10;
}
