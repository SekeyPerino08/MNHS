import { Suspense } from "react";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { TeacherGradesOverview } from "../../../../features/grades/components/TeacherGradesOverview";

export default function TeacherGradesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <RoleGuard allowedRoles={["TEACHER"]}>
        <DashboardLayout>
          <div className="mx-auto max-w-7xl space-y-6">
            <header>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Teacher grades</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Grade book</h1>
              <p className="mt-1 text-sm text-slate-500">Open a class to review and update grades for the current school year.</p>
            </header>
            <TeacherGradesOverview />
          </div>
        </DashboardLayout>
      </RoleGuard>
    </Suspense>
  );
}
