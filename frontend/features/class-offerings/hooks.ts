"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkCreateClassOfferings, createClassOffering, deleteClassOffering, fetchClassOffering, fetchClassOfferings, fetchMyClasses, fetchMyEnrollment, fetchOfferingStudents, updateClassOffering } from "./api";

export const classOfferingKeys = {
  all: ["class-offerings"] as const,
  lists: () => [...classOfferingKeys.all, "list"] as const,
  list: (params: object) => [...classOfferingKeys.lists(), params] as const,
  detail: (id: string) => [...classOfferingKeys.all, "detail", id] as const,
  students: (id: string) => [...classOfferingKeys.all, "students", id] as const,
};
export const meKeys = {
  classes: (schoolYearId?: string) => ["me", "classes", schoolYearId ?? "current"] as const,
  enrollment: () => ["me", "enrollment"] as const,
};

export function useClassOfferings(params: Parameters<typeof fetchClassOfferings>[0], enabled = true) {
  return useQuery({ queryKey: classOfferingKeys.list(params), queryFn: () => fetchClassOfferings(params), placeholderData: (previous) => previous, enabled });
}
export function useClassOffering(id: string) {
  return useQuery({ queryKey: classOfferingKeys.detail(id), queryFn: async () => (await fetchClassOffering(id)).data, enabled: Boolean(id) });
}
export function useOfferingStudents(id: string) {
  return useQuery({ queryKey: classOfferingKeys.students(id), queryFn: async () => (await fetchOfferingStudents(id)).data, enabled: Boolean(id) });
}
export function useMyClasses(schoolYearId?: string, enabled = true) {
  return useQuery({ queryKey: meKeys.classes(schoolYearId), queryFn: () => fetchMyClasses(schoolYearId), enabled });
}
export function useMyEnrollment() {
  return useQuery({ queryKey: meKeys.enrollment(), queryFn: fetchMyEnrollment });
}

function useInvalidateClassSurfaces() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: classOfferingKeys.all }),
      client.invalidateQueries({ queryKey: ["sections"] }),
      client.invalidateQueries({ queryKey: ["enrollments"] }),
      client.invalidateQueries({ queryKey: ["subjects"] }),
      client.invalidateQueries({ queryKey: ["me", "classes"] }),
      client.invalidateQueries({ queryKey: ["me", "enrollment"] }),
    ]);
  };
}
export function useCreateClassOffering() { const invalidate = useInvalidateClassSurfaces(); return useMutation({ mutationFn: createClassOffering, onSuccess: invalidate }); }
export function useBulkCreateClassOfferings() { const invalidate = useInvalidateClassSurfaces(); return useMutation({ mutationFn: bulkCreateClassOfferings, onSuccess: invalidate }); }
export function useUpdateClassOffering() {
  const invalidate = useInvalidateClassSurfaces();
  return useMutation({
    mutationFn: ({ id, teacherId }: { id: string; teacherId: string }) => updateClassOffering(id, teacherId),
    onSuccess: invalidate,
  });
}
export function useDeleteClassOffering() { const invalidate = useInvalidateClassSurfaces(); return useMutation({ mutationFn: deleteClassOffering, onSuccess: invalidate }); }
