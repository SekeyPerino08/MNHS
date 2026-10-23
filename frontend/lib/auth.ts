import type { Role } from "../types/auth";

export function dashboardPath(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
  }
}

export function userDisplayName(user: {
  email: string;
  profile: { firstName?: string; lastName?: string } | null;
}): string {
  const name = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ");
  return name || user.email;
}
