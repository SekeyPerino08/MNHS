// Includes today and the previous six calendar days for teacher edits.
export const TEACHER_EDIT_WINDOW_DAYS = 7;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function parseDateString(value: string): Date {
  if (!isValidDateString(value)) {
    throw new Error("Date must be a real calendar date in YYYY-MM-DD format");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function formatDateString(value: Date | string): string {
  if (typeof value === "string") {
    const dateOnly = value.slice(0, 10);
    if (isValidDateString(dateOnly)) return dateOnly;
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) throw new Error("Cannot format an invalid date");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error("Cannot format an invalid date");
    return formatDateParts(parsed);
  }
  if (Number.isNaN(value.getTime())) throw new Error("Cannot format an invalid date");
  return formatDateParts(value);
}

function formatDateParts(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function todayInManila(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
