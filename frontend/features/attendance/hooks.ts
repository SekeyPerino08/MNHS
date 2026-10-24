"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAttendanceDates, fetchAttendanceSheet, fetchAttendanceSummary, fetchMyAttendance, saveAttendance } from "./api";

export const attendanceKeys = {
  all: ["attendance"] as const,
  sheet: (classOfferingId: string, date: string) => [...attendanceKeys.all, "sheet", classOfferingId, date] as const,
  sheets: (classOfferingId: string) => [...attendanceKeys.all, "sheet", classOfferingId] as const,
  summary: (classOfferingId: string, from: string, to: string) => [...attendanceKeys.all, "summary", classOfferingId, from, to] as const,
  summaries: (classOfferingId: string) => [...attendanceKeys.all, "summary", classOfferingId] as const,
  dates: (classOfferingId: string, month: string) => [...attendanceKeys.all, "dates", classOfferingId, month] as const,
  dateLists: (classOfferingId: string) => [...attendanceKeys.all, "dates", classOfferingId] as const,
  mine: (params: object) => [...attendanceKeys.all, "mine", params] as const,
};

export function useAttendanceSheet(classOfferingId: string, date: string) {
  return useQuery({
    queryKey: attendanceKeys.sheet(classOfferingId, date),
    queryFn: () => fetchAttendanceSheet(classOfferingId, date),
    enabled: Boolean(classOfferingId && date),
  });
}

export function useSaveAttendance(classOfferingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveAttendance>[1]) => saveAttendance(classOfferingId, input),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.sheet(classOfferingId, input.date) }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.dateLists(classOfferingId) }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.summaries(classOfferingId) }),
      ]);
    },
  });
}

export function useAttendanceSummary(classOfferingId: string, from: string, to: string) {
  return useQuery({
    queryKey: attendanceKeys.summary(classOfferingId, from, to),
    queryFn: () => fetchAttendanceSummary(classOfferingId, { from, to }),
    enabled: Boolean(classOfferingId && from && to),
    placeholderData: (previous) => previous,
  });
}

export function useAttendanceDates(classOfferingId: string, month: string) {
  return useQuery({
    queryKey: attendanceKeys.dates(classOfferingId, month),
    queryFn: () => fetchAttendanceDates(classOfferingId, month),
    enabled: Boolean(classOfferingId && month),
  });
}

export function useMyAttendance(params: Parameters<typeof fetchMyAttendance>[0]) {
  return useQuery({
    queryKey: attendanceKeys.mine(params),
    queryFn: () => fetchMyAttendance(params),
    placeholderData: (previous) => previous,
  });
}
