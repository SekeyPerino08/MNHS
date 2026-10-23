"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSchoolYear, fetchCurrentSchoolYear, fetchSchoolYears, setCurrentSchoolYear, updateSchoolYear, updateTerm } from "./api";
import type { SchoolYearInput, TermInput } from "./types";
export const schoolYearKeys = { all: ["school-years"] as const, list: () => [...schoolYearKeys.all, "list"] as const, current: () => [...schoolYearKeys.all, "current"] as const };
export function useSchoolYears() { return useQuery({ queryKey: schoolYearKeys.list(), queryFn: fetchSchoolYears }); }
export function useCurrentSchoolYear() { return useQuery({ queryKey: schoolYearKeys.current(), queryFn: fetchCurrentSchoolYear, retry: false }); }
function useInvalidateSchoolYears() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: schoolYearKeys.all }),
      client.invalidateQueries({ queryKey: ["sections"] }),
    ]);
  };
}
export function useCreateSchoolYear() { const invalidate = useInvalidateSchoolYears(); return useMutation({ mutationFn: createSchoolYear, onSuccess: invalidate }); }
export function useUpdateSchoolYear() { const invalidate = useInvalidateSchoolYears(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<SchoolYearInput> }) => updateSchoolYear(id, input), onSuccess: invalidate }); }
export function useSetCurrentSchoolYear() { const invalidate = useInvalidateSchoolYears(); return useMutation({ mutationFn: setCurrentSchoolYear, onSuccess: invalidate }); }
export function useUpdateTerm() { const invalidate = useInvalidateSchoolYears(); return useMutation({ mutationFn: ({ schoolYearId, termId, input }: { schoolYearId: string; termId: string; input: TermInput }) => updateTerm(schoolYearId, termId, input), onSuccess: invalidate }); }
