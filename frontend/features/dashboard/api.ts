import { apiFetch } from "../../lib/api";
import type { AdminDashboardData, StudentDashboardData, TeacherDashboardData } from "../../types/dashboard";

export const fetchAdminDashboard = () => apiFetch<AdminDashboardData>("/api/dashboard/admin");
export const fetchTeacherDashboard = () => apiFetch<TeacherDashboardData>("/api/dashboard/teacher");
export const fetchStudentDashboard = () => apiFetch<StudentDashboardData>("/api/dashboard/student");
