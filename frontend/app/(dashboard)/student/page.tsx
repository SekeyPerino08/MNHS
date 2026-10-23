"use client";

import { DashboardHome } from "../../../components/DashboardHome";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { RoleGuard } from "../../../components/RoleGuard";
import { useAuth } from "../../../providers/AuthProvider";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>{user && <DashboardHome user={user} />}</DashboardLayout>
    </RoleGuard>
  );
}
