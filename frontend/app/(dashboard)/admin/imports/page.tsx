"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../components/RoleGuard";
import { ImportWizard } from "../../../../features/imports/components/ImportWizard";

export default function AdminImportsPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <Suspense fallback={<div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-16 rounded-xl bg-slate-200" /><div className="h-96 rounded-2xl bg-slate-200" /></div>}>
          <ImportWizard />
        </Suspense>
      </DashboardLayout>
    </RoleGuard>
  );
}
