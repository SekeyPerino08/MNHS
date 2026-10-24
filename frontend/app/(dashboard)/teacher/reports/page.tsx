"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { ReportsHub } from "../../../../features/reports/components/ReportsHub";

export default function TeacherReportsPage() {
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><ReportsHub /></DashboardLayout></RoleGuard>;
}
