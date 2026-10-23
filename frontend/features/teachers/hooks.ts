"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createTeacher, createTeacherAccount, fetchTeacher, fetchTeachers, updateTeacher, updateTeacherStatus } from "./api";
import type { TeacherInput, TeacherListParams } from "./types";

export const teacherKeys = {
  all: ["teachers"] as const,
  lists: () => [...teacherKeys.all, "list"] as const,
  list: (params: TeacherListParams) => [...teacherKeys.lists(), params] as const,
  details: () => [...teacherKeys.all, "detail"] as const,
  detail: (id: string) => [...teacherKeys.details(), id] as const,
};
export function useTeachers(params: TeacherListParams) {
  return useQuery({ queryKey: teacherKeys.list(params), queryFn: () => fetchTeachers(params), placeholderData: (previous) => previous });
}
export function useTeacher(id: string) {
  return useQuery({ queryKey: teacherKeys.detail(id), queryFn: async () => (await fetchTeacher(id)).data, enabled: Boolean(id) });
}
function useInvalidateTeachers() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: teacherKeys.all });
}
export function useCreateTeacher() {
  const invalidate = useInvalidateTeachers();
  return useMutation({ mutationFn: createTeacher, onSuccess: invalidate });
}
export function useUpdateTeacher() {
  const invalidate = useInvalidateTeachers();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Omit<TeacherInput, "employeeNo">> }) => updateTeacher(id, input), onSuccess: invalidate });
}
export function useUpdateTeacherStatus() {
  const invalidate = useInvalidateTeachers();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: { isActive: boolean; reason?: string } }) => updateTeacherStatus(id, input), onSuccess: invalidate });
}
export function useCreateTeacherAccount() {
  const client = useQueryClient();
  const [isPending, setPending] = useState(false);
  async function createAccount(id: string, input: { email: string; temporaryPassword?: string }) {
    setPending(true);
    try {
      const result = (await createTeacherAccount(id, input)).data;
      await client.invalidateQueries({ queryKey: teacherKeys.all });
      return result;
    } finally { setPending(false); }
  }
  return { createAccount, isPending };
}
