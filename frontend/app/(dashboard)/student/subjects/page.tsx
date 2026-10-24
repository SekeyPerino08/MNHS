"use client";

import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { StudentSubjectsView } from "../../../../features/enrollment/components/StudentSubjectsView";

export default function StudentSubjectsPage() {
  return <RoleGuard allowedRoles={["STUDENT"]}><DashboardLayout><StudentSubjectsView /></DashboardLayout></RoleGuard>;
}
