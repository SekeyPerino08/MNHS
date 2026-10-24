"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../../components/RoleGuard";
import { BatchReportCards } from "../../../../../../features/report-card/components/BatchReportCards";

export default function AdminSectionReportCardsPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [includeUnreleased, setIncludeUnreleased] = useState(false);

  useEffect(() => {
    void params.then(({ id: resolvedId }) => setId(resolvedId));
  }, [params]);

  if (!id) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-200" />;
  }

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Section report cards</h1>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeUnreleased} onChange={(event) => setIncludeUnreleased(event.target.checked)} />
            Include unreleased grades
          </label>
        </div>
        <BatchReportCards sectionId={id} includeUnreleased={includeUnreleased} title="Section report cards" />
      </DashboardLayout>
    </RoleGuard>
  );
}
