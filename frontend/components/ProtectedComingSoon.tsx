"use client";

import { ComingSoon } from "./ComingSoon";
import { DashboardLayout } from "./DashboardLayout";
import { RoleGuard } from "./RoleGuard";
import type { Role } from "../types/auth";

export function ProtectedComingSoon({
  role,
  section,
}: Readonly<{ role: Role; section: string }>) {
  return (
    <RoleGuard allowedRoles={[role]}>
      <DashboardLayout>
        <ComingSoon section={section} />
      </DashboardLayout>
    </RoleGuard>
  );
}
