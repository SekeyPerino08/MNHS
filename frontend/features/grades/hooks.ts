"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchClassGradeSheet, fetchMyGrades } from "./api";

export const gradeKeys = {
  all: ["grades"] as const,
  sheet: (classOfferingId: string) => [...gradeKeys.all, "sheet", classOfferingId] as const,
  me: (params: { schoolYearId?: string } = {}) => [...gradeKeys.all, "me", params] as const,
};

export function useClassGradeSheet(classOfferingId: string) {
  return useQuery({
    queryKey: gradeKeys.sheet(classOfferingId),
    queryFn: () => fetchClassGradeSheet(classOfferingId),
    enabled: Boolean(classOfferingId),
  });
}

export function useMyGrades(params: { schoolYearId?: string } = {}) {
  return useQuery({
    queryKey: gradeKeys.me(params),
    queryFn: () => fetchMyGrades(params),
    placeholderData: (previous) => previous,
  });
}
