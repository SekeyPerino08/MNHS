// The school system uses 75 as its standard passing grade.
export const PASSING_GRADE = 75;

export function calculateFinalGrade(scores: (number | null)[]): number | null {
  if (scores.length !== 4 || scores.some((score) => score === null)) return null;
  const total = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  // The four-quarter average is rounded to the nearest whole number.
  return Math.round(total / 4);
}

export function calculateGeneralAverage(finalGrades: (number | null)[]): number | null {
  const releasedGrades = finalGrades.filter((grade): grade is number => grade !== null);
  if (!releasedGrades.length) return null;
  // Only subjects that have a final grade are included in the general average.
  const total = releasedGrades.reduce((sum, grade) => sum + grade, 0);
  return Math.round((total / releasedGrades.length) * 100) / 100;
}

export type GradeDescriptor =
  | "Outstanding"
  | "Very Satisfactory"
  | "Satisfactory"
  | "Fairly Satisfactory"
  | "Did Not Meet Expectations";

export function getGradeDescriptor(score: number | null): GradeDescriptor | null {
  if (score === null) return null;
  if (score >= 90) return "Outstanding";
  if (score >= 85) return "Very Satisfactory";
  if (score >= 80) return "Satisfactory";
  if (score >= PASSING_GRADE) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

export function isPassing(score: number | null): boolean | null {
  return score === null ? null : score >= PASSING_GRADE;
}
