import type { Role } from "../../types/auth";

export interface ManagedUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  person: {
    type: "STUDENT" | "TEACHER";
    id: string;
    name: string;
    number: string;
  } | null;
}

export interface UsersResponse {
  data: ManagedUser[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface UsersParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  isActive?: "true" | "false";
  state?: "locked" | "mustChange";
  sortBy: "email" | "createdAt" | "lastLoginAt";
  order: "asc" | "desc";
}
