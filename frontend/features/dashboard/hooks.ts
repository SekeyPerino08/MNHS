"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdminDashboard, fetchStudentDashboard, fetchTeacherDashboard } from "./api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  admin: () => [...dashboardKeys.all, "admin"] as const,
  teacher: () => [...dashboardKeys.all, "teacher"] as const,
  student: () => [...dashboardKeys.all, "student"] as const,
};

const dashboardQueryOptions = { staleTime: 60_000, refetchOnWindowFocus: true } as const;

export function useAdminDashboard() {
  return useQuery({ queryKey: dashboardKeys.admin(), queryFn: fetchAdminDashboard, ...dashboardQueryOptions });
}

export function useTeacherDashboard() {
  return useQuery({ queryKey: dashboardKeys.teacher(), queryFn: fetchTeacherDashboard, ...dashboardQueryOptions });
}

export function useStudentDashboard() {
  return useQuery({ queryKey: dashboardKeys.student(), queryFn: fetchStudentDashboard, ...dashboardQueryOptions });
}
