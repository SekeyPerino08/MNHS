import assert from "node:assert/strict";
import { ImportType } from "@prisma/client";
import { mapHeaders } from "../src/modules/imports/etl/mapHeaders.js";
import { parseCsv } from "../src/modules/imports/etl/parse.js";
import { transformRows } from "../src/modules/imports/etl/transform.js";
import {
  addIssue,
  addPossibleDuplicateWarnings,
  finalizeRows,
  summarizeRows,
  validateExistingNumbers,
  validateInFileDuplicates,
} from "../src/modules/imports/etl/validate.js";
import { writeCsv } from "../src/utils/csv.js";
import { AppError } from "../src/utils/AppError.js";
import { csvTemplate, rejectedRowsCsv } from "../src/modules/imports/etl/report.js";
import type { ImportOptions, TransformedRow } from "../src/modules/imports/import.types.js";

const studentHeaders = ["Student Number", "First Name", "Middle Name", "Last Name", "Gender", "DOB"];

function transformStudent(values: string[], dateFormat: ImportOptions["dateFormat"]) {
  const csv = parseCsv(Buffer.from(`${studentHeaders.join(",")}\n${values.join(",")}\n`));
  const mapping = mapHeaders(csv.headers, ImportType.STUDENTS);
  return transformRows(csv, mapping, ImportType.STUDENTS, { dateFormat })[0];
}

const commaCsv = parseCsv(Buffer.from(
  '\uFEFFStudent Number,First Name,Middle Name,Last Name,Gender,DOB\r\n00123,"  MARIA  ",,"Dela, Cruz",F,2012-05-14\r\n\r\n',
));
assert.equal(commaCsv.delimiter, ",");
assert.equal(commaCsv.rows[0].rowNumber, 2);
const mappedStudent = mapHeaders(commaCsv.headers, ImportType.STUDENTS);
assert.equal(mappedStudent.recognized.length, 6);
assert.deepEqual(mappedStudent.ignored, []);
const transformedStudent = transformRows(commaCsv, mappedStudent, ImportType.STUDENTS, {
  dateFormat: "ISO",
})[0];
assert.equal(transformedStudent.status, "VALID");
assert.equal(transformedStudent.pending.firstName, "Maria");
assert.equal(transformedStudent.pending.lastName, "Dela, Cruz");
assert.equal(transformedStudent.pending.studentNo, "00123");
assert.ok(transformedStudent.changes.some(({ field, from, to }) => field === "firstName" && from === "  MARIA  " && to === "Maria"));

const semicolonCsv = parseCsv(Buffer.from(
  "student_no;given_name;family-name;gender;birth-date\n00200;Jose;Reyes;MALE;14/05/2012\n",
));
assert.equal(semicolonCsv.delimiter, ";");
assert.equal(
  transformRows(
    semicolonCsv,
    mapHeaders(semicolonCsv.headers, ImportType.STUDENTS),
    ImportType.STUDENTS,
    { dateFormat: "DMY" },
  )[0].pending.birthDate,
  "2012-05-14",
);

assert.throws(
  () => mapHeaders(["Student Number", "First Name"], ImportType.STUDENTS),
  (error: unknown) => error instanceof AppError && error.code === "MISSING_COLUMNS",
);
assert.throws(
  () => mapHeaders(["student-no", "Student Number", "First Name", "Last Name", "Sex", "DOB"], ImportType.STUDENTS),
  (error: unknown) => error instanceof AppError && error.code === "DUPLICATE_COLUMNS",
);
assert.deepEqual(
  mapHeaders(["Student Number", "First Name", "Last Name", "Sex", "DOB", "Unknown Column"], ImportType.STUDENTS).ignored,
  ["Unknown Column"],
);

for (const [input, expected] of [
  ["M", "MALE"], ["male", "MALE"], ["Lalaki", "MALE"],
  ["F", "FEMALE"], ["female", "FEMALE"], ["Babae", "FEMALE"],
] as const) {
  assert.equal(transformStudent(["12345", "Ana", "", "Reyes", input, "2012-05-14"], "ISO").pending.sex, expected);
}
assert.ok(transformStudent(["12345", "Ana", "", "Reyes", "other", "2012-05-14"], "ISO").errors.some(({ field }) => field === "sex"));

assert.equal(transformStudent(["12345", "Ana", "", "Reyes", "F", "2012-05-14"], "ISO").pending.birthDate, "2012-05-14");
assert.equal(transformStudent(["12345", "Ana", "", "Reyes", "F", "5/14/2012"], "MDY").pending.birthDate, "2012-05-14");
assert.equal(transformStudent(["12345", "Ana", "", "Reyes", "F", "14.5.2012"], "DMY").pending.birthDate, "2012-05-14");
assert.equal(transformStudent(["12345", "Ana", "", "Reyes", "F", "03/04/2012"], "MDY").pending.birthDate, "2012-03-04");
assert.equal(transformStudent(["12345", "Ana", "", "Reyes", "F", "03/04/2012"], "DMY").pending.birthDate, "2012-04-03");
assert.ok(transformStudent(["12345", "Ana", "", "Reyes", "F", "2012-02-31"], "ISO").errors.some(({ field }) => field === "birthDate"));
assert.ok(transformStudent(["12345", "Ana", "", "Reyes", "F", "1/2/12"], "MDY").errors.some(({ field }) => field === "birthDate"));
assert.ok(transformStudent(["1.00E+11", "Ana", "", "Reyes", "F", "2012-05-14"], "ISO").errors.some(({ message }) => message.includes("Format the column as Text")));
assert.equal(transformStudent(["12345", "ñora", "", "dela ñora", "F", "2012-05-14"], "ISO").pending.firstName, "Ñora");

assert.throws(
  () => parseCsv(Buffer.from("a,b\n1,\"unfinished")),
  (error: unknown) => error instanceof AppError && error.code === "MALFORMED_CSV" && error.message.includes("line"),
);
assert.throws(
  () => parseCsv(Buffer.from([0, 1, 2])),
  (error: unknown) => error instanceof AppError && error.code === "NOT_A_CSV",
);
assert.throws(
  () => parseCsv(Buffer.from([0xc3, 0x28])),
  (error: unknown) => error instanceof AppError && error.code === "INVALID_ENCODING" && error.message.includes("CSV UTF-8"),
);
assert.equal(parseCsv(Buffer.from("A,B\n1,2\n\n3,4\n")).rows[1].rowNumber, 4);
assert.equal(parseCsv(Buffer.from('A,B\n1,"two\nlines"\n3,4\n')).rows[1].rowNumber, 4);
assert.throws(
  () => parseCsv(Buffer.from(`A\n${Array.from({ length: 1001 }, (_, index) => index).join("\n")}`)),
  (error: unknown) => error instanceof AppError && error.code === "TOO_MANY_ROWS" && error.message.includes("1,000"),
);
assert.throws(
  () => parseCsv(Buffer.from(`${Array.from({ length: 31 }, (_, index) => `c${index}`).join(",")}\n`)),
  (error: unknown) => error instanceof AppError && error.code === "TOO_MANY_COLUMNS",
);
const longCell = parseCsv(Buffer.from(`A\n${"x".repeat(201)}\n`));
assert.equal(longCell.rows[0].errors[0]?.message, "Cell must be 200 characters or fewer");

const phoneHeaders = ["employeeNo", "firstName", "lastName", "contactNo"];
const teacherCsv = parseCsv(Buffer.from(`${phoneHeaders.join(",")}\nEMP 1, MARIA, Dela Ñora,+639171234567\n`));
const teacherRows = transformRows(
  teacherCsv,
  mapHeaders(teacherCsv.headers, ImportType.TEACHERS),
  ImportType.TEACHERS,
  { dateFormat: "ISO" },
);
assert.equal(teacherRows[0].pending.employeeNo, "EMP1");
assert.equal(teacherRows[0].pending.firstName, "Maria");
assert.equal(teacherRows[0].pending.lastName, "Dela Ñora");
assert.equal(teacherRows[0].pending.contactNo, "09171234567");
const teacherNoPlusCsv = parseCsv(Buffer.from(`${phoneHeaders.join(",")}\nEMP-2,Jose,Santos,639171234567\n`));
assert.equal(
  transformRows(
    teacherNoPlusCsv,
    mapHeaders(teacherNoPlusCsv.headers, ImportType.TEACHERS),
    ImportType.TEACHERS,
    { dateFormat: "ISO" },
  )[0].pending.contactNo,
  "09171234567",
);

const duplicateCsv = parseCsv(Buffer.from(
  `${studentHeaders.join(",")}\nS-1,Ana,,Reyes,F,2012-01-01\nS-1,Bea,,Santos,F,2012-01-02\n`,
));
const duplicateRows = transformRows(
  duplicateCsv,
  mapHeaders(duplicateCsv.headers, ImportType.STUDENTS),
  ImportType.STUDENTS,
  { dateFormat: "ISO" },
);
validateInFileDuplicates(duplicateRows, ImportType.STUDENTS);
assert.equal(duplicateRows[0].status, "VALID");
assert.ok(duplicateRows[1].errors.some(({ message }) => message === "Duplicate of row 2 in this file"));
validateExistingNumbers(duplicateRows, ImportType.STUDENTS, new Set(["s-1"]));
assert.ok(duplicateRows[0].errors.some(({ message }) => message === "Already exists"));

const personDuplicates = transformRows(
  parseCsv(Buffer.from(`${studentHeaders.join(",")}\nS-3,Ana,,Reyes,F,2012-01-01\nS-4,Ana,,Reyes,F,2012-01-01\n`)),
  mapHeaders(studentHeaders, ImportType.STUDENTS),
  ImportType.STUDENTS,
  { dateFormat: "ISO" },
);
addPossibleDuplicateWarnings(personDuplicates, ImportType.STUDENTS, new Map());
assert.equal(personDuplicates[1].status, "WARNING");
assert.ok(personDuplicates[1].warnings[0].message.includes("S-3"));
const matchingExisting = transformRows(
  parseCsv(Buffer.from(`${studentHeaders.join(",")}\nS-5,Ana,,Reyes,F,2012-01-01\n`)),
  mapHeaders(studentHeaders, ImportType.STUDENTS),
  ImportType.STUDENTS,
  { dateFormat: "ISO" },
);
addPossibleDuplicateWarnings(matchingExisting, ImportType.STUDENTS, new Map([
  ["ana|reyes|2012-01-01", ["S-EXISTING"]],
]));
assert.equal(matchingExisting[0].status, "WARNING");
assert.ok(matchingExisting[0].warnings[0].message.includes("S-EXISTING"));

const preview = finalizeRows(personDuplicates);
assert.equal("pending" in preview[0], false);
assert.deepEqual(summarizeRows(preview), {
  totalRows: 2, validRows: 1, warningRows: 1, errorRows: 0,
});
assert.ok(csvTemplate(ImportType.STUDENTS).startsWith("\uFEFFstudentNo,firstName"));
assert.ok(csvTemplate(ImportType.TEACHERS).includes("EMP-EXAMPLE-01"));
assert.ok(rejectedRowsCsv(preview, studentHeaders).includes("rowNumber,status,messages"));
const warning = personDuplicates[1];
addIssue(warning, { field: "test", message: "invalid" });
assert.equal(warning.status, "ERROR");
assert.equal(warning.normalized, null);

const csv = writeCsv(
  [{ name: "Ana", notes: 'said "hello", ok\nnext' }],
  ["name", "notes"],
);
assert.equal(csv, '\uFEFFname,notes\r\nAna,"said ""hello"", ok\nnext"\r\n');
assert.equal(writeCsv([{ formula: "=1+1" }, { formula: "+1" }, { formula: "-1" }, { formula: "@x" }], ["formula"]),
  "\uFEFFformula\r\n'=1+1\r\n'+1\r\n'-1\r\n'@x\r\n");
assert.equal(writeCsv([{ formula: "\t=1+1" }, { formula: "\r=1+1" }], ["formula"]),
  "\uFEFFformula\r\n'\t=1+1\r\n\"'\r=1+1\"\r\n");

console.log("CSV import unit tests passed");
