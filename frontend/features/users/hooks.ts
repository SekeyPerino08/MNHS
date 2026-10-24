"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeUserEmail, fetchUsers, forceLogoutUser, unlockUser, updateUserStatus } from "./api";
import type { UsersParams } from "./types";

export const userKeys = {
  all: ["managed-users"] as const,
  list: (params: UsersParams) => [...userKeys.all, params] as const,
};

export function useUsers(params: UsersParams) {
  return useQuery({ queryKey: userKeys.list(params), queryFn: () => fetchUsers(params), placeholderData: (previous) => previous });
}

function useInvalidateUsers() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: userKeys.all });
}

export function useChangeUserEmail() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: ({ id, email }: { id: string; email: string }) => changeUserEmail(id, email), onSuccess: invalidate });
}
export function useUpdateUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }) => updateUserStatus(id, isActive, reason), onSuccess: invalidate });
}
export function useUnlockUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: unlockUser, onSuccess: invalidate });
}
export function useForceLogoutUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: forceLogoutUser, onSuccess: invalidate });
}
