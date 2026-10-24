import { Suspense } from "react";
import { DashboardLayout } from "../../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../../components/RoleGuard";
import { AttendanceSheetView } from "../../../../../../features/attendance/components/AttendanceSheetView";

export default function AttendancePage({ params }: { params: Promise<{ offeringId: string }> }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><AttendancePageContent params={params} /></Suspense>;
}

async function AttendancePageContent({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><DashboardLayout><AttendanceSheetView offeringId={offeringId} /></DashboardLayout></RoleGuard>;
}
