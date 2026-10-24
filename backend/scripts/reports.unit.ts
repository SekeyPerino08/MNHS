import assert from "node:assert/strict";
import { buildAttendanceDaily, buildAttendanceSummary } from "../src/modules/reports/builders/class-attendance.builder.js";
import { buildClassGrades } from "../src/modules/reports/builders/class-grades.builder.js";
import { ageAsOf } from "../src/modules/reports/builders/shared.js";
import { enforceExportRowLimit } from "../src/modules/reports/export.service.js";
import { writeCsv } from "../src/utils/csv.js";
import { buildReportFilename, sanitizeFilenameScopePart } from "../src/utils/filename.js";
import { AppError } from "../src/utils/AppError.js";

const hostileScope = `../School "Year"/../../`;
const sanitized = sanitizeFilenameScopePart(hostileScope);
assert.match(sanitized, /^[a-z0-9-]+$/);
assert.ok(!sanitized.includes(".."));
assert.equal(
  buildReportFilename("students-masterlist", [hostileScope], "2026-03-04", true),
  "students-masterlist_school-year_DRAFT_2026-03-04.csv",
);

const student = {
  id: "student-1",
  studentNo: "S-1",
  firstName: "Ana",
  middleName: null,
  lastName: "Santos",
  sex: "FEMALE",
};
const daily = buildAttendanceDaily([student], [
  { studentId: student.id, date: "2026-01-02", status: "PRESENT" },
  { studentId: student.id, date: "2026-01-03", status: "ABSENT" },
]);
assert.deepEqual(daily.columns.slice(3, 5).map(({ label }) => label), ["2026-01-02", "2026-01-03"]);
assert.equal(daily.rows[0]?.["date_2026-01-02"], "P");
assert.equal(daily.rows[0]?.["date_2026-01-03"], "A");

const summary = buildAttendanceSummary([student], [
  { studentId: student.id, date: "2026-01-02", status: "EXCUSED" },
]);
assert.equal(summary.rows[0]?.attendanceRate, null);

const classGrades = buildClassGrades(
  [student],
  [
    { id: "term-1", termNumber: 1 },
    { id: "term-2", termNumber: 2 },
    { id: "term-3", termNumber: 3 },
    { id: "term-4", termNumber: 4 },
  ],
  [
    { studentId: student.id, termId: "term-1", score: 90, remarks: null },
    { studentId: student.id, termId: "term-2", score: 90, remarks: null },
    { studentId: student.id, termId: "term-3", score: 90, remarks: null },
  ],
);
assert.equal(classGrades.rows[0]?.finalGrade, null);
assert.equal(classGrades.rows[0]?.remarks, null);

assert.equal(ageAsOf("2012-03-04", "2026-03-03"), 13);
assert.equal(ageAsOf("2012-03-04", "2026-03-04"), 14);
assert.equal(ageAsOf("2030-01-01", "2026-03-04"), null);

assert.doesNotThrow(() => enforceExportRowLimit(20_000));
assert.throws(
  () => enforceExportRowLimit(20_001),
  (error: unknown) => error instanceof AppError && error.statusCode === 413 && error.code === "EXPORT_TOO_LARGE",
);

const csv = writeCsv([["=1+1"]], ["value"]);
assert.ok(csv.endsWith("\r\n'=1+1\r\n"));
console.log("Reports helper tests passed");
