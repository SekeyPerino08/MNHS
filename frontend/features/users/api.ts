import { apiFetch } from "../../lib/api";
import type { UsersParams, UsersResponse } from "./types";

export function fetchUsers(params: UsersParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<UsersResponse>(`/api/users?${query.toString()}`);
}

export function createAdminUser(input: { email: string; temporaryPassword?: string }) {
  return apiFetch<{ user: { id: string; email: string }; temporaryPassword: string }>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function changeUserEmail(id: string, email: string) {
  return apiFetch(`/api/users/${encodeURIComponent(id)}/email`, {
    method: "PATCH",
    body: JSON.stringify({ email }),
  });
}

export function resetUserPassword(id: string, temporaryPassword?: string) {
  return apiFetch<{ temporaryPassword: string }>(`/api/users/${encodeURIComponent(id)}/reset-password`, {
    method: "POST",
    body: JSON.stringify(temporaryPassword ? { temporaryPassword } : {}),
  });
}

export function updateUserStatus(id: string, isActive: boolean, reason?: string) {
  return apiFetch(`/api/users/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive, ...(reason ? { reason } : {}) }),
  });
}

export function unlockUser(id: string) {
  return apiFetch(`/api/users/${encodeURIComponent(id)}/unlock`, { method: "POST" });
}

export function forceLogoutUser(id: string) {
  return apiFetch(`/api/users/${encodeURIComponent(id)}/force-logout`, { method: "POST" });
}
