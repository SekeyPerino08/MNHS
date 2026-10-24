"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchMyReportCard,
  fetchMyReportCardYears,
  fetchSectionReportCards,
  fetchStudentReportCard,
} from "./api";

export const reportCardKeys = {
  all: ["report-card"] as const,
  my: (schoolYearId?: string) => [...reportCardKeys.all, "me", schoolYearId ?? "current"] as const,
  years: () => [...reportCardKeys.all, "years"] as const,
  student: (studentId: string, schoolYearId?: string, includeUnreleased = false) =>
    [...reportCardKeys.all, "student", studentId, schoolYearId ?? "current", includeUnreleased] as const,
  section: (sectionId: string, includeUnreleased = false) =>
    [...reportCardKeys.all, "section", sectionId, includeUnreleased] as const,
};

export function useMyReportCard(schoolYearId?: string) {
  return useQuery({
    queryKey: reportCardKeys.my(schoolYearId),
    queryFn: () => fetchMyReportCard(schoolYearId),
    enabled: true,
    placeholderData: (previous) => previous,
  });
}

export function useMyReportCardYears() {
  return useQuery({
    queryKey: reportCardKeys.years(),
    queryFn: fetchMyReportCardYears,
  });
}

export function useStudentReportCard(studentId: string, schoolYearId?: string, includeUnreleased = false) {
  return useQuery({
    queryKey: reportCardKeys.student(studentId, schoolYearId, includeUnreleased),
    queryFn: () => fetchStudentReportCard(studentId, schoolYearId, includeUnreleased),
    enabled: Boolean(studentId),
    placeholderData: (previous) => previous,
  });
}

export function useSectionReportCards(sectionId: string, includeUnreleased = false) {
  return useQuery({
    queryKey: reportCardKeys.section(sectionId, includeUnreleased),
    queryFn: () => fetchSectionReportCards(sectionId, includeUnreleased),
    enabled: Boolean(sectionId),
  });
}
