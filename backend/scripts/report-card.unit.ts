import assert from "node:assert/strict";
import type { EnrollmentStatus } from "@prisma/client";
import { assembleReportCardFromData } from "../src/modules/report-cards/report-cards.service.js";

const terms = [
  { id: "t1", name: "Term 1", termNumber: 1, gradesLocked: false, startDate: new Date("2025-08-01T00:00:00.000Z"), endDate: new Date("2025-10-31T00:00:00.000Z") },
  { id: "t2", name: "Term 2", termNumber: 2, gradesLocked: false, startDate: new Date("2025-11-01T00:00:00.000Z"), endDate: new Date("2026-01-15T00:00:00.000Z") },
  { id: "t3", name: "Term 3", termNumber: 3, gradesLocked: false, startDate: new Date("2026-01-16T00:00:00.000Z"), endDate: new Date("2026-03-31T00:00:00.000Z") },
  { id: "t4", name: "Term 4", termNumber: 4, gradesLocked: true, startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2026-06-30T00:00:00.000Z") },
];

const data = {
  student: {
    id: "student-1",
    studentNo: "S-001",
    firstName: "Juan",
    middleName: "Dela",
    lastName: "Cruz",
    sex: "MALE",
    birthDate: new Date("2011-04-15T00:00:00.000Z"),
  },
  enrollment: { status: "ENROLLED" as EnrollmentStatus },
  schoolYear: { id: "school-year-1", name: "2025-2026" },
  section: { id: "section-1", gradeLevel: 7, name: "Rizal" },
  adviser: { firstName: "Maria", lastName: "Santos" },
  terms,
  classOfferings: [
    {
      id: "offering-1",
      subject: { code: "MATH", name: "Mathematics" },
      teacher: { firstName: "Maria", middleName: "B", lastName: "Santos" },
    },
  ],
  gradeRows: [
    { classOfferingId: "offering-1", termId: "t1", score: 80 },
    { classOfferingId: "offering-1", termId: "t2", score: 82 },
    { classOfferingId: "offering-1", termId: "t3", score: 84 },
  ],
  attendanceRows: [
    {
      studentId: "student-1",
      classOfferingId: "offering-1",
      date: new Date("2025-09-10T00:00:00.000Z"),
      status: "EXCUSED",
      classOffering: { sectionId: "section-1" },
    },
    {
      studentId: "student-1",
      classOfferingId: "offering-1",
      date: new Date("2025-09-11T00:00:00.000Z"),
      status: "PRESENT",
      classOffering: { sectionId: "section-1" },
    },
  ],
  includeUnreleased: false,
};

const result = assembleReportCardFromData(data);
assert.equal(result.subjects[0].quarters[0].score, null);
assert.equal(result.subjects[0].quarters[0].released, false);
assert.equal(result.subjects[0].finalGrade, null);
assert.equal(result.summary.allSubjectsPassed, null);
assert.equal(result.attendance.overall.rate, 100);

const allVisible = assembleReportCardFromData({
  ...data,
  gradeRows: [
    { classOfferingId: "offering-1", termId: "t1", score: 80 },
    { classOfferingId: "offering-1", termId: "t2", score: 82 },
    { classOfferingId: "offering-1", termId: "t3", score: 84 },
    { classOfferingId: "offering-1", termId: "t4", score: 88 },
  ],
  includeUnreleased: true,
});
assert.equal(allVisible.subjects[0].finalGrade, 84);
assert.equal(allVisible.summary.allSubjectsPassed, true);
assert.equal(allVisible.attendance.overall.rate, 100);

const zeroCount = assembleReportCardFromData({
  ...data,
  attendanceRows: [
    {
      studentId: "student-1",
      classOfferingId: "offering-1",
      date: new Date("2025-09-10T00:00:00.000Z"),
      status: "EXCUSED",
      classOffering: { sectionId: "section-1" },
    },
  ],
  includeUnreleased: true,
});
assert.equal(zeroCount.attendance.overall.rate, null);

console.log("Report card assembly tests passed");
