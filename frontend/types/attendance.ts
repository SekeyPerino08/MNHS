export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceRosterStudent {
  studentId: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: AttendanceStatus | null;
  remarks: string | null;
}

export interface AttendanceSheet {
  date: string;
  recorded: boolean;
  editable: boolean;
  roster: AttendanceRosterStudent[];
}

export interface AttendanceRecordInput {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface AttendanceSummaryStudent {
  id: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number | null;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  students: AttendanceSummaryStudent[];
  overall: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    rate: number | null;
    recordedDates: number;
  };
}

export interface AttendanceRecordedDate {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface MyAttendanceData {
  records: Array<{
    date: string;
    subject: { id: string; code: string; name: string };
    status: AttendanceStatus;
    remarks: string | null;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: {
    bySubject: Array<{
      subject: { id: string; code: string; name: string };
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
      rate: number | null;
    }>;
    overall: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
      rate: number | null;
    };
  };
  from: string;
  to: string;
}
