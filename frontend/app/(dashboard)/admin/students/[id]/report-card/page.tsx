"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, RefreshCcw } from "lucide-react";
import { DashboardLayout } from "../../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../../components/RoleGuard";
import { PrintToolbar } from "../../../../../../features/report-card/components/PrintToolbar";
import { ReportCardView } from "../../../../../../features/report-card/components/ReportCard";
import { useStudentReportCard } from "../../../../../../features/report-card/hooks";
import { mapReportCardError } from "../../../../../../features/report-card/components/PrintToolbar";

export default function AdminStudentReportCardPage({ params }: { params: Promise<{ id: string }> }) {
  const [schoolYearId, setSchoolYearId] = useState<string | undefined>(undefined);
  const [includeUnreleased, setIncludeUnreleased] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => setResolvedId(id));
  }, [params]);

  const reportCard = useStudentReportCard(resolvedId ?? "", schoolYearId, includeUnreleased);

  if (!resolvedId) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-200" />;
  }

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student report card</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Student report card</h1>
            </div>
            <Link href={`/admin/students/${resolvedId}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
              <ArrowLeft size={17} aria-hidden="true" /> Back to student
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <label className="flex flex-1 flex-col gap-2 text-sm text-slate-700">
                <span className="font-semibold">School year</span>
                <input
                  value={schoolYearId ?? ""}
                  onChange={(event) => setSchoolYearId(event.target.value || undefined)}
                  placeholder="School year id"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-indigo-500"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={includeUnreleased} onChange={(event) => setIncludeUnreleased(event.target.checked)} />
                Include unreleased grades (draft preview)
              </label>
            </div>
          </div>

          {reportCard.isError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
              <div className="mb-3 inline-flex rounded-full bg-rose-100 p-2"><AlertCircle size={18} aria-hidden="true" /></div>
              <div>{mapReportCardError(reportCard.error)}</div>
              <button type="button" onClick={() => void reportCard.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"><RefreshCcw size={15} aria-hidden="true" /> Retry</button>
            </div>
          )}

          {!reportCard.isError && reportCard.data && (
            <>
              <PrintToolbar />
              <ReportCardView data={reportCard.data} />
            </>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
