import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import { calculateAttendanceRate, canEditAttendance } from "../src/modules/attendance/attendance.rules.js";
import { formatDateString, isValidDateString, parseDateString, todayInManila } from "../src/utils/dates.js";

const schoolYear = {
  startDate: "2025-08-01",
  endDate: "2026-06-30",
};

assert.equal(isValidDateString("2026-02-28"), true);
assert.equal(isValidDateString("2024-02-29"), true);
assert.equal(isValidDateString("2026-02-31"), false);
assert.equal(isValidDateString("2026-2-03"), false);
assert.equal(formatDateString(parseDateString("2026-02-28")), "2026-02-28");
assert.equal(todayInManila(new Date("2026-01-01T16:30:00.000Z")), "2026-01-02");

assert.equal(canEditAttendance({ role: Role.ADMIN }, "2025-08-01", schoolYear, "2026-06-30"), true);
assert.equal(canEditAttendance({ role: Role.TEACHER }, "2026-06-24", schoolYear, "2026-06-30"), true);
assert.throws(
  () => canEditAttendance({ role: Role.TEACHER }, "2026-06-23", schoolYear, "2026-06-30"),
  { code: "EDIT_WINDOW_CLOSED" },
);
assert.throws(
  () => canEditAttendance({ role: Role.ADMIN }, "2025-07-31", schoolYear, "2026-06-30"),
  { code: "OUTSIDE_SCHOOL_YEAR" },
);
assert.throws(
  () => canEditAttendance({ role: Role.ADMIN }, "2026-07-01", schoolYear, "2026-06-30"),
  { code: "FUTURE_DATE" },
);

assert.equal(calculateAttendanceRate({ present: 2, late: 1, absent: 1, excused: 5 }), 75);
assert.equal(calculateAttendanceRate({ present: 0, late: 0, absent: 0, excused: 3 }), null);

console.log("Attendance helper tests passed");
