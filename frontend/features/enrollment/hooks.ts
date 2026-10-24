"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkEnroll, createEnrollment, fetchEnrollments, fetchUnassignedStudents, transferEnrollment, updateEnrollmentStatus } from "./api";
import type { EnrollmentListParams, UnassignedParams } from "./types";

export const enrollmentKeys = {
  all: ["enrollments"] as const,
  lists: () => [...enrollmentKeys.all, "list"] as const,
  list: (params: EnrollmentListParams) => [...enrollmentKeys.lists(), params] as const,
  unassigned: (params: UnassignedParams) => [...enrollmentKeys.all, "unassigned", params] as const,
};

function useInvalidateEnrollmentSurfaces() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: enrollmentKeys.all }),
      client.invalidateQueries({ queryKey: ["sections"] }),
      client.invalidateQueries({ queryKey: ["class-offerings"] }),
      client.invalidateQueries({ queryKey: ["students"] }),
      client.invalidateQueries({ queryKey: ["me", "classes"] }),
      client.invalidateQueries({ queryKey: ["me", "enrollment"] }),
    ]);
  };
}

export function useEnrollments(params: EnrollmentListParams, enabled = true) {
  return useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: () => fetchEnrollments(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useUnassignedStudents(params: UnassignedParams, enabled = true) {
  return useQuery({
    queryKey: enrollmentKeys.unassigned(params),
    queryFn: () => fetchUnassignedStudents(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useCreateEnrollment() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({ mutationFn: createEnrollment, onSuccess: invalidate });
}

export function useBulkEnroll() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({ mutationFn: bulkEnroll, onSuccess: invalidate });
}

export function useTransferEnrollment() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({
    mutationFn: ({ id, sectionId }: { id: string; sectionId: string }) => transferEnrollment(id, sectionId),
    onSuccess: invalidate,
  });
}

export function useUpdateEnrollmentStatus() {
  const invalidate = useInvalidateEnrollmentSurfaces();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { status: "ENROLLED" | "DROPPED" | "COMPLETED"; reason?: string } }) =>
      updateEnrollmentStatus(id, input),
    onSuccess: invalidate,
  });
}
