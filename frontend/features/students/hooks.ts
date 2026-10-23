"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import type { StudentListParams, StudentStatus } from "../../types/student";
import {
  createStudent,
  fetchStudent,
  fetchStudents,
  updateStudent,
  updateStudentStatus,
} from "./api";

export const studentQueryKeys = {
  all: ["students"] as const,
  lists: () => [...studentQueryKeys.all, "list"] as const,
  list: (params: StudentListParams) => [...studentQueryKeys.lists(), params] as const,
  details: () => [...studentQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...studentQueryKeys.details(), id] as const,
};

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: studentQueryKeys.list(params),
    queryFn: () => fetchStudents(params),
    placeholderData: (previous) => previous,
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: studentQueryKeys.detail(id),
    queryFn: () => fetchStudent(id),
    enabled: Boolean(id),
  });
}

function useInvalidateStudents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: studentQueryKeys.all });
}

export function useCreateStudent() {
  const invalidate = useInvalidateStudents();
  return useMutation({ mutationFn: createStudent, onSuccess: invalidate });
}

export function useUpdateStudent() {
  const invalidate = useInvalidateStudents();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateStudent>[1] }) => updateStudent(id, input), onSuccess: invalidate });
}

export function useUpdateStudentStatus() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { status: StudentStatus; reason?: string } }) =>
      updateStudentStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateStudentAccount() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const createAccount = async (variables: {
    id: string;
    input: { email: string; temporaryPassword?: string };
  }) => {
    setIsPending(true);
    try {
      const result = await apiFetch<{ data: import("./api").StudentAccountResult }>(
        `/api/students/${encodeURIComponent(variables.id)}/account`,
        { method: "POST", body: JSON.stringify(variables.input) },
      );
      await queryClient.invalidateQueries({ queryKey: studentQueryKeys.all });
      return result.data;
    } finally {
      setIsPending(false);
    }
  };
  return { createAccount, isPending };
}
