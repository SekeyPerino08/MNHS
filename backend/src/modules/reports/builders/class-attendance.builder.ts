import { calculateAttendanceRate } from "../../attendance/attendance.rules.js";
import type { AttendanceStatus } from "@prisma/client";
import type { BuiltReport } from "./types.js";
import type { StudentReportFields } from "./shared.js";

export interface AttendanceStudent extends StudentReportFields {
  id: string;
}

export interface AttendanceRecord {
  studentId: string;
  date: string;
  status: AttendanceStatus;
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export function attendanceCounts(records: readonly AttendanceRecord[]): AttendanceCounts {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const record of records) {
    switch (record.status) {
      case "PRESENT": counts.present += 1; break;
      case "ABSENT": counts.absent += 1; break;
      case "LATE": counts.late += 1; break;
      case "EXCUSED": counts.excused += 1; break;
    }
  }
  return counts;
}

function totalsRow(student: AttendanceStudent, records: readonly AttendanceRecord[]) {
  const counts = attendanceCounts(records.filter((record) => record.studentId === student.id));
  // EXCUSED records are excluded from the denominator, matching every other attendance screen.
  return {
    studentNo: student.studentNo,
    lastName: student.lastName,
    firstName: student.firstName,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    excused: counts.excused,
    daysRecorded: counts.present + counts.absent + counts.late + counts.excused,
    attendanceRate: calculateAttendanceRate(counts),
  };
}

const fixedColumns = [
  { key: "studentNo", label: "Student No" },
  { key: "lastName", label: "Last Name" },
  { key: "firstName", label: "First Name" },
] as const;

const totalColumns = [
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "late", label: "Late" },
  { key: "excused", label: "Excused" },
  { key: "daysRecorded", label: "Days Recorded" },
  { key: "attendanceRate", label: "Attendance Rate %" },
] as const;

export function buildAttendanceSummary(
  students: readonly AttendanceStudent[],
  records: readonly AttendanceRecord[],
): BuiltReport {
  return {
    columns: [...fixedColumns, ...totalColumns],
    rows: students.map((student) => totalsRow(student, records)),
  };
}

export function buildAttendanceDaily(
  students: readonly AttendanceStudent[],
  records: readonly AttendanceRecord[],
): BuiltReport {
  const dates = [...new Set(records.map((record) => record.date))].sort();
  if (dates.length > 200) {
    throw new RangeError("Daily attendance exports are limited to 200 recorded dates. Choose a smaller date range.");
  }
  const recordByStudentDate = new Map(records.map((record) => [`${record.studentId}:${record.date}`, record.status]));
  const dateColumns = dates.map((date) => ({ key: `date_${date}`, label: date }));
  return {
    columns: [...fixedColumns, ...dateColumns, ...totalColumns],
    rows: students.map((student) => ({
      ...totalsRow(student, records),
      ...Object.fromEntries(dates.map((date) => [
        `date_${date}`,
        statusCode(recordByStudentDate.get(`${student.id}:${date}`)),
      ])),
    })),
  };
}

function statusCode(status: AttendanceStatus | undefined): string | null {
  switch (status) {
    case "PRESENT": return "P";
    case "ABSENT": return "A";
    case "LATE": return "L";
    case "EXCUSED": return "E";
    default: return null;
  }
}
