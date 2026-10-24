import assert from "node:assert/strict";
import {
  calculateFinalGrade,
  calculateGeneralAverage,
  getGradeDescriptor,
  isPassing,
  PASSING_GRADE,
} from "../src/utils/grading.js";

assert.equal(PASSING_GRADE, 75);
assert.equal(calculateFinalGrade([80, 90, 100, 70]), 85);
assert.equal(calculateFinalGrade([80, null, 100, 70]), null);
assert.equal(calculateFinalGrade([80, 80, 80, 82]), 81);
assert.equal(calculateFinalGrade([80, 80, 80, 82]), Math.round(80.5));
assert.equal(calculateFinalGrade([80, 80, 80, 84]), 81);

assert.equal(calculateGeneralAverage([90, 80, null]), 85);
assert.equal(calculateGeneralAverage([90.12, 80.13, null]), 85.13);
assert.equal(calculateGeneralAverage([null, null]), null);

assert.equal(getGradeDescriptor(null), null);
assert.equal(getGradeDescriptor(74), "Did Not Meet Expectations");
assert.equal(getGradeDescriptor(75), "Fairly Satisfactory");
assert.equal(getGradeDescriptor(79), "Fairly Satisfactory");
assert.equal(getGradeDescriptor(80), "Satisfactory");
assert.equal(getGradeDescriptor(84), "Satisfactory");
assert.equal(getGradeDescriptor(85), "Very Satisfactory");
assert.equal(getGradeDescriptor(89), "Very Satisfactory");
assert.equal(getGradeDescriptor(90), "Outstanding");

assert.equal(isPassing(null), null);
assert.equal(isPassing(74), false);
assert.equal(isPassing(75), true);

console.log("Grading helper tests passed");
