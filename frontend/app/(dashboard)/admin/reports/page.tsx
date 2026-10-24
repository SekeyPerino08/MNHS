"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { ReportsHub } from "../../../../features/reports/components/ReportsHub";

export default function AdminReportsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><ReportsHub /></DashboardLayout></RoleGuard>;
}
