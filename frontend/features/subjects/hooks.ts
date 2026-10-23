"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSubject, deleteSubject, fetchSubjects, updateSubject } from "./api";
import type { SubjectInput, SubjectParams } from "./types";
export const subjectKeys = { all: ["subjects"] as const, lists: () => [...subjectKeys.all, "list"] as const, list: (params: SubjectParams) => [...subjectKeys.lists(), params] as const };
export function useSubjects(params: SubjectParams) {
  return useQuery({ queryKey: subjectKeys.list(params), queryFn: () => fetchSubjects(params), placeholderData: (previous) => previous });
}
function useInvalidateSubjects() {
  const client = useQueryClient(); return () => client.invalidateQueries({ queryKey: subjectKeys.all });
}
export function useCreateSubject() { const invalidate = useInvalidateSubjects(); return useMutation({ mutationFn: createSubject, onSuccess: invalidate }); }
export function useUpdateSubject() { const invalidate = useInvalidateSubjects(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<SubjectInput> }) => updateSubject(id, input), onSuccess: invalidate }); }
export function useDeleteSubject() { const invalidate = useInvalidateSubjects(); return useMutation({ mutationFn: deleteSubject, onSuccess: invalidate }); }
