import { Suspense } from "react";
import { DashboardLayout } from "../../../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../../../components/RoleGuard";
import { AttendanceSummaryView } from "../../../../../../../features/attendance/components/AttendanceSummaryView";

export default function AttendanceSummaryPage({ params }: { params: Promise<{ offeringId: string }> }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><AttendanceSummaryPageContent params={params} /></Suspense>;
}

async function AttendanceSummaryPageContent({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><DashboardLayout><AttendanceSummaryView offeringId={offeringId} /></DashboardLayout></RoleGuard>;
}
