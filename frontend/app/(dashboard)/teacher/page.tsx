"use client";

import { DashboardHome } from "../../../components/DashboardHome";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { useAuth } from "../../../providers/AuthProvider";

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>{user && <DashboardHome user={user} />}</DashboardLayout>
    </RoleGuard>
  );
}
