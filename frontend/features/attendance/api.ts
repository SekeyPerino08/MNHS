import { apiFetch } from "../../lib/api";
import type {
  AttendanceRecordInput,
  AttendanceRecordedDate,
  AttendanceSheet,
  AttendanceSummary,
  MyAttendanceData,
} from "../../types/attendance";

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

interface RawAttendanceStudent {
  id?: string;
  studentId?: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status?: AttendanceSheet["roster"][number]["status"];
  remarks?: string | null;
  attendance?: { status: AttendanceSheet["roster"][number]["status"]; remarks: string | null } | null;
}

interface RawAttendanceSheet {
  date: string;
  recorded: boolean;
  editable: boolean;
  roster?: RawAttendanceStudent[];
  students?: RawAttendanceStudent[];
}

export async function fetchAttendanceSheet(classOfferingId: string, date: string): Promise<AttendanceSheet> {
  const response = await apiFetch<RawAttendanceSheet>(
    `/api/class-offerings/${encodeURIComponent(classOfferingId)}/attendance?${queryString({ date })}`,
  );
  const roster = response.roster ?? response.students ?? [];
  return {
    date: response.date,
    recorded: response.recorded,
    editable: response.editable,
    roster: roster.map((student) => ({
      studentId: student.studentId ?? student.id ?? "",
      studentNo: student.studentNo,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      status: student.status ?? student.attendance?.status ?? null,
      remarks: student.remarks ?? student.attendance?.remarks ?? null,
    })),
  };
}

export function saveAttendance(classOfferingId: string, input: { date: string; records: AttendanceRecordInput[] }) {
  return apiFetch<{ date: string; saved: number; summary: { present: number; absent: number; late: number; excused: number } }>(
    `/api/class-offerings/${encodeURIComponent(classOfferingId)}/attendance`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function fetchAttendanceSummary(classOfferingId: string, params: { from: string; to: string }) {
  return apiFetch<AttendanceSummary>(
    `/api/class-offerings/${encodeURIComponent(classOfferingId)}/attendance/summary?${queryString(params)}`,
  );
}

export function fetchAttendanceDates(classOfferingId: string, month: string) {
  return apiFetch<{ month: string; dates: AttendanceRecordedDate[] }>(
    `/api/class-offerings/${encodeURIComponent(classOfferingId)}/attendance/dates?${queryString({ month })}`,
  );
}

export function fetchMyAttendance(params: {
  from?: string;
  to?: string;
  classOfferingId?: string;
  page: number;
  pageSize: number;
}) {
  return apiFetch<MyAttendanceData>(`/api/me/attendance?${queryString(params)}`);
}
