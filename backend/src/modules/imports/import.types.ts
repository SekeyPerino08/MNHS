export type ImportField =
  | "studentNo"
  | "employeeNo"
  | "firstName"
  | "middleName"
  | "lastName"
  | "sex"
  | "birthDate"
  | "address"
  | "guardianName"
  | "guardianContact"
  | "department"
  | "contactNo"
  | "gradeLevel"
  | "section";

export interface RowIssue {
  field: string;
  message: string;
}

export interface ImportOptions {
  dateFormat: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
}

export interface StudentImportValues {
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: "MALE" | "FEMALE";
  birthDate: string;
  address: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  gradeLevel?: number;
  section?: string;
}

export interface TeacherImportValues {
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  department: string | null;
  contactNo: string | null;
}

export interface CommitStudentData extends StudentImportValues {
  sectionId?: string;
  schoolYearId?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: string[];
  values: Record<string, string | number | null>;
  errors: RowIssue[];
  warnings: RowIssue[];
  commitData?: CommitStudentData | TeacherImportValues;
}

export interface ParsedCsv {
  delimiter: "," | ";";
  headers: string[];
  rows: Array<{ cells: string[]; rowNumber: number }>;
}
