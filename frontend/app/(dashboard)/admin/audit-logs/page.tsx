"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { AuditPage } from "../../../../features/audit/components/AuditPage";

export default function AdminAuditLogsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><AuditPage /></DashboardLayout></RoleGuard>;
}
