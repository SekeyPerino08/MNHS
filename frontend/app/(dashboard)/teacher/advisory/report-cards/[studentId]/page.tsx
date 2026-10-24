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

export default function TeacherStudentReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ studentId: resolvedStudentId }) => setStudentId(resolvedStudentId));
  }, [params]);

  const reportCard = useStudentReportCard(studentId ?? "");

  if (!studentId) return <div className="h-32 animate-pulse rounded-xl bg-slate-200" />;

  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Report card</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Student report card</h1>
            </div>
            <Link href="/teacher/advisory/report-cards" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
              <ArrowLeft size={17} aria-hidden="true" /> Back to advisory report cards
            </Link>
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
