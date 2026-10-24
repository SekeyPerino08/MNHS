import { apiFetch } from "../../lib/api";
import type { Role } from "../../types/auth";

export interface MyProfile {
  user: {
    email: string;
    role: Role;
    createdAt: string;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
  };
  person:
    | { type: "STUDENT"; studentNo: string; fullName: string; currentSection: string | null }
    | { type: "TEACHER"; employeeNo: string; fullName: string; department: string | null; contactNo: string | null }
    | null;
}

export function fetchMyProfile() {
  return apiFetch<MyProfile>("/api/me/profile");
}
