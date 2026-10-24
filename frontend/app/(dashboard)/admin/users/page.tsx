"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { UsersPage } from "../../../../features/users/components/UsersPage";

export default function AdminUsersPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><UsersPage /></DashboardLayout></RoleGuard>;
}
