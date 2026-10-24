import assert from "node:assert/strict";
import { getGradeBucket } from "../src/modules/dashboard/dashboard.service.js";
import { lastSchoolDays, selectCurrentTerm, type DashboardTerm } from "../src/modules/dashboard/dashboard.helpers.js";

function term(id: string, startDate: string, endDate: string): DashboardTerm {
  return {
    id,
    name: id,
    termNumber: 1,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    gradesLocked: false,
  };
}

const current = term("current", "2025-03-01", "2025-03-31");
const previous = term("previous", "2025-01-01", "2025-01-31");
const future = term("future", "2025-04-01", "2025-04-30");

assert.deepEqual(selectCurrentTerm([previous, current], "2025-03-12"), {
  term: current,
  source: "contains_today",
});
assert.deepEqual(selectCurrentTerm([previous, current], "2025-02-20"), {
  term: previous,
  source: "most_recent",
});
assert.deepEqual(selectCurrentTerm([current, future], "2024-12-31"), {
  term: current,
  source: "first",
});
assert.deepEqual(selectCurrentTerm([], "2025-01-01"), { term: null, source: null });

assert.deepEqual(
  lastSchoolDays(5, "2025-01-06", {
    startDate: new Date("2025-01-04T00:00:00.000Z"),
    endDate: new Date("2025-06-30T00:00:00.000Z"),
  }),
  ["2025-01-04", "2025-01-06"],
);
assert.deepEqual(
  lastSchoolDays(5, "2025-01-06", {
    startDate: new Date("2025-01-05T00:00:00.000Z"),
    endDate: new Date("2025-06-30T00:00:00.000Z"),
  }),
  ["2025-01-06"],
);
assert.deepEqual(
  lastSchoolDays(5, "2025-01-06", {
    startDate: new Date("2025-01-03T00:00:00.000Z"),
    endDate: new Date("2025-01-04T00:00:00.000Z"),
  }),
  ["2025-01-03", "2025-01-04"],
);

assert.equal(getGradeBucket(74), "below75");
assert.equal(getGradeBucket(75), "75-79");
assert.equal(getGradeBucket(79), "75-79");
assert.equal(getGradeBucket(80), "80-84");
assert.equal(getGradeBucket(84), "80-84");
assert.equal(getGradeBucket(85), "85-89");
assert.equal(getGradeBucket(89), "85-89");
assert.equal(getGradeBucket(90), "90-100");
assert.equal(getGradeBucket(100), "90-100");

console.log("Dashboard helper tests passed");
