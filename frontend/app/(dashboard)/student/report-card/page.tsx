"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { ErrorState } from "../../../../components/shared";
import { RoleGuard } from "../../../../components/RoleGuard";
import { PrintToolbar, mapReportCardError } from "../../../../features/report-card/components/PrintToolbar";
import { ReportCardView } from "../../../../features/report-card/components/ReportCard";
import { useMyReportCard, useMyReportCardYears } from "../../../../features/report-card/hooks";

export default function StudentReportCardPage() {
  const years = useMyReportCardYears();
  const [schoolYearId, setSchoolYearId] = useState<string | undefined>(undefined);
  const availableYears = years.data ?? [];

  useEffect(() => {
    if (!schoolYearId && availableYears[0]) {
      setSchoolYearId(availableYears[0].id);
    }
  }, [availableYears, schoolYearId]);

  const reportCard = useMyReportCard(schoolYearId);
  const selectedId = schoolYearId ?? availableYears[0]?.id;

  if (years.isLoading || (selectedId && reportCard.isLoading && !reportCard.data)) {
    return (
      <RoleGuard allowedRoles={["STUDENT"]}>
        <DashboardLayout>
          <div className="mx-auto max-w-5xl animate-pulse space-y-5">
            <div className="h-10 w-40 rounded-lg bg-slate-200" />
            <div className="h-16 rounded-2xl bg-slate-200" />
            <div className="h-[900px] rounded-2xl bg-slate-200" />
          </div>
        </DashboardLayout>
      </RoleGuard>
    );
  }

  if (years.isError) {
    return (
      <RoleGuard allowedRoles={["STUDENT"]}>
        <DashboardLayout>
          <ErrorState title="Could not load report card years" error={years.error} retry={() => void years.refetch()} />
        </DashboardLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student report card</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">My report card</h1>
            </div>
            <Link href="/student" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
              <ArrowLeft size={17} aria-hidden="true" /> Back to dashboard
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-semibold">School year</span>
              <select
                value={selectedId ?? ""}
                onChange={(event) => setSchoolYearId(event.target.value || undefined)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-indigo-500"
              >
                {availableYears.length ? (
                  availableYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))
                ) : (
                  <option value="">No year available</option>
                )}
              </select>
            </label>
          </div>

          {reportCard.isError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
              <div className="mb-3 inline-flex rounded-full bg-rose-100 p-2"><AlertCircle size={18} aria-hidden="true" /></div>
              <div>{mapReportCardError(reportCard.error)}</div>
              <button
                type="button"
                onClick={() => void reportCard.refetch()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCcw size={15} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {!reportCard.isError && reportCard.data && (
            <>
              <PrintToolbar />
              <ReportCardView data={reportCard.data} />
            </>
          )}

          {!reportCard.isError && !reportCard.data && !availableYears.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              No report card is available because the student was not enrolled that year.
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
