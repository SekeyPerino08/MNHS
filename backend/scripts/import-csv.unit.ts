import assert from "node:assert/strict";
import { ImportType } from "@prisma/client";
import { mapHeaders } from "../src/modules/imports/map-headers.js";
import { parseCsv } from "../src/modules/imports/parse.js";
import { transformRows } from "../src/modules/imports/transform.js";
import {
  addPossibleDuplicateWarnings,
  rowStatus,
  summarizeRows,
  validateUniqueNumbers,
} from "../src/modules/imports/validate.js";
import { writeCsv } from "../src/utils/csv.js";
import { AppError } from "../src/utils/AppError.js";
import type { ImportPreviewRow } from "../src/modules/imports/import.types.js";

const studentHeaders = ["Student Number", "First Name", "Middle Name", "Last Name", "Gender", "DOB"];
const studentHeaderMap = mapHeaders(studentHeaders, ImportType.STUDENTS);

const commaCsv = parseCsv(Buffer.from(
  'Student Number,First Name,Middle Name,Last Name,Gender,DOB\r\n00123,  MARIA  ,,"Dela, Cruz",F,2012-05-14\r\n\r\n',
));
assert.equal(commaCsv.delimiter, ",");
assert.equal(commaCsv.rows[0].rowNumber, 2);
const transformedStudent = transformRows(commaCsv, studentHeaderMap, ImportType.STUDENTS, {
  dateFormat: "YYYY-MM-DD",
})[0];
assert.equal(transformedStudent.errors.length, 0);
assert.equal(transformedStudent.commitData?.firstName, "Maria");
assert.equal(transformedStudent.commitData?.lastName, "Dela, Cruz");
assert.equal(transformedStudent.commitData?.studentNo, "00123");

const semicolonCsv = parseCsv(Buffer.from(
  "Student Number;First Name;Last Name;Gender;DOB\n00200;Jose;Reyes;MALE;14/05/2012\n",
));
assert.equal(semicolonCsv.delimiter, ";");
const semicolonRows = transformRows(
  semicolonCsv,
  mapHeaders(semicolonCsv.headers, ImportType.STUDENTS),
  ImportType.STUDENTS,
  { dateFormat: "DD/MM/YYYY" },
);
assert.equal(semicolonRows[0].errors.length, 0);
assert.equal(semicolonRows[0].commitData?.birthDate, "2012-05-14");

const invalidDate = transformRows(
  parseCsv(Buffer.from("Student Number,First Name,Last Name,Sex,Birth Date\n00300,Ana,Reyes,F,45292\n")),
  mapHeaders(["Student Number", "First Name", "Last Name", "Sex", "Birth Date"], ImportType.STUDENTS),
  ImportType.STUDENTS,
  { dateFormat: "MM/DD/YYYY" },
)[0];
assert.ok(invalidDate.errors.some(({ field }) => field === "birthDate"));

assert.throws(
  () => parseCsv(Buffer.from("a,b\n1,\"unfinished")),
  (error: unknown) => error instanceof AppError && error.code === "INVALID_CSV",
);
assert.throws(
  () => parseCsv(Buffer.from([0, 1, 2])),
  (error: unknown) => error instanceof AppError && error.code === "INVALID_CSV",
);
assert.throws(
  () => parseCsv(Buffer.from([0xc3, 0x28])),
  (error: unknown) => error instanceof AppError && error.code === "INVALID_CSV",
);
assert.throws(
  () => mapHeaders(["Student Number", "Student No", "First Name", "Last Name", "Sex", "DOB"], ImportType.STUDENTS),
  (error: unknown) => error instanceof AppError && error.code === "DUPLICATE_HEADERS",
);
assert.throws(
  () => mapHeaders(["Student Number", "First Name", "Mystery", "Mystery", "Last Name", "Sex", "DOB"], ImportType.STUDENTS),
  (error: unknown) => error instanceof AppError && error.code === "DUPLICATE_HEADERS",
);
assert.throws(
  () => mapHeaders(["Student Number", "First Name"], ImportType.STUDENTS),
  (error: unknown) => error instanceof AppError && error.code === "MISSING_HEADERS",
);
assert.equal(parseCsv(Buffer.from("A,B\n1,2\n\n3,4\n")).rows[1].rowNumber, 4);
assert.equal(parseCsv(Buffer.from('A,B\n1,"two\nlines"\n3,4\n')).rows[1].rowNumber, 4);
assert.throws(
  () => parseCsv(Buffer.from(`A\n${Array.from({ length: 1001 }, (_, index) => index).join("\n")}`)),
  (error: unknown) => error instanceof AppError && error.code === "TOO_MANY_ROWS",
);
assert.throws(
  () => parseCsv(Buffer.from(`${Array.from({ length: 31 }, (_, index) => `c${index}`).join(",")}\n`)),
  (error: unknown) => error instanceof AppError && error.code === "TOO_MANY_COLUMNS",
);

const duplicateRows: ImportPreviewRow[] = [
  {
    rowNumber: 2,
    raw: [],
    values: { studentNo: "S-1", firstName: "Ana", lastName: "Reyes", birthDate: "2012-01-01" },
    errors: [],
    warnings: [],
    commitData: {
      studentNo: "S-1", firstName: "Ana", middleName: null, lastName: "Reyes", sex: "FEMALE",
      birthDate: "2012-01-01", address: null, guardianName: null, guardianContact: null,
    },
  },
  {
    rowNumber: 3,
    raw: [],
    values: { studentNo: "S-2", firstName: "Ana", lastName: "Reyes", birthDate: "2012-01-01" },
    errors: [],
    warnings: [],
    commitData: {
      studentNo: "S-2", firstName: "Ana", middleName: null, lastName: "Reyes", sex: "FEMALE",
      birthDate: "2012-01-01", address: null, guardianName: null, guardianContact: null,
    },
  },
];
validateUniqueNumbers(duplicateRows, ImportType.STUDENTS, new Set(["s-2"]));
assert.ok(duplicateRows[1].errors.some(({ field }) => field === "studentNo"));
addPossibleDuplicateWarnings(duplicateRows, new Map());
assert.ok(duplicateRows[1].warnings.some(({ message }) => message.includes("S-1")));
assert.equal(rowStatus(duplicateRows[1]), "ERROR");
assert.deepEqual(summarizeRows(duplicateRows), {
  totalRows: 2,
  validRows: 1,
  warningRows: 0,
  errorRows: 1,
});
assert.equal(writeCsv([["name", "notes"], ["Ana", 'said "hello", ok']]), 'name,notes\r\nAna,"said ""hello"", ok"');
assert.equal(writeCsv([["formula"], ["  =1+1"]]), "formula\r\n'  =1+1");

console.log("CSV import unit tests passed");
