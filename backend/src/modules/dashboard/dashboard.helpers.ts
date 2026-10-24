import { prisma } from "../../lib/prisma.js";
import { formatDateString, parseDateString, todayInManila } from "../../utils/dates.js";

export type CurrentTermSource = "contains_today" | "most_recent" | "first";

export interface DashboardTerm {
  id: string;
  name: string;
  termNumber: number;
  startDate: Date;
  endDate: Date;
  gradesLocked: boolean;
}

export interface CurrentContext {
  today: string;
  schoolYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    terms: DashboardTerm[];
  } | null;
  currentTerm: DashboardTerm | null;
  currentTermSource: CurrentTermSource | null;
}

export function selectCurrentTerm(
  terms: readonly DashboardTerm[],
  today: string,
): { term: DashboardTerm | null; source: CurrentTermSource | null } {
  if (!terms.length) return { term: null, source: null };
  const todayDate = parseDateString(today);
  const containing = terms.find((term) => (
    parseDateString(formatDateString(term.startDate)) <= todayDate
    && parseDateString(formatDateString(term.endDate)) >= todayDate
  ));
  if (containing) return { term: containing, source: "contains_today" };

  const started = terms
    .filter((term) => parseDateString(formatDateString(term.startDate)) <= todayDate)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
  if (started) return { term: started, source: "most_recent" };
  return { term: terms[0], source: "first" };
}

export async function getCurrentContext(): Promise<CurrentContext> {
  const today = todayInManila();
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      terms: {
        orderBy: { termNumber: "asc" },
        select: {
          id: true,
          name: true,
          termNumber: true,
          startDate: true,
          endDate: true,
          gradesLocked: true,
        },
      },
    },
  });
  if (!schoolYear) {
    return { today, schoolYear: null, currentTerm: null, currentTermSource: null };
  }
  const selection = selectCurrentTerm(schoolYear.terms, today);
  return {
    today,
    schoolYear,
    currentTerm: selection.term,
    currentTermSource: selection.source,
  };
}

export function lastSchoolDays(
  n: number,
  today: string,
  schoolYear: Pick<NonNullable<CurrentContext["schoolYear"]>, "startDate" | "endDate"> | null,
): string[] {
  if (!schoolYear || n <= 0) return [];
  const todayDate = parseDateString(today);
  const startDate = parseDateString(formatDateString(schoolYear.startDate));
  const endDate = parseDateString(formatDateString(schoolYear.endDate));
  const cursor = todayDate < endDate ? todayDate : endDate;
  const days: string[] = [];

  // Saturday classes may be held; days without records are omitted from trend data rather than counted as zero.
  while (cursor >= startDate && days.length < n) {
    if (cursor.getUTCDay() !== 0) days.push(formatDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

// This cache is per-process and is fine for one server; use Redis or remove it if the app is scaled out.
export async function cacheFor<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.value as T;

  const value = await fn();
  cache.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}
