import { Suspense } from "react";
import { DashboardLayout } from "../../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../../components/RoleGuard";
import { GradeSheetView } from "../../../../../../features/grades/components/GradeSheetView";

export default function TeacherClassGradesPage({ params }: { params: Promise<{ offeringId: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <TeacherClassGradesContent params={params} />
    </Suspense>
  );
}

async function TeacherClassGradesContent({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return (
    <RoleGuard allowedRoles={["TEACHER", "ADMIN"]}>
      <DashboardLayout>
        <GradeSheetView offeringId={offeringId} />
      </DashboardLayout>
    </RoleGuard>
  );
}
