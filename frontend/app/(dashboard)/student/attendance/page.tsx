import { Suspense } from "react";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { MyAttendanceView } from "../../../../features/attendance/components/MyAttendanceView";

export default function StudentAttendancePage() {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><RoleGuard allowedRoles={["STUDENT"]}><DashboardLayout><MyAttendanceView /></DashboardLayout></RoleGuard></Suspense>;
}
