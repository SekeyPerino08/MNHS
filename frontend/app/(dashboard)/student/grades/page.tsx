import { Suspense } from "react";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { MyGradesView } from "../../../../features/grades/components/MyGradesView";

export default function StudentGradesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <RoleGuard allowedRoles={["STUDENT"]}>
        <DashboardLayout>
          <MyGradesView />
        </DashboardLayout>
      </RoleGuard>
    </Suspense>
  );
}
