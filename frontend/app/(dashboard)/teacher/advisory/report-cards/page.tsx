"use client";

import { DashboardLayout } from "../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../components/RoleGuard";
import { useMyClasses } from "../../../../../features/class-offerings/hooks";
import { BatchReportCards } from "../../../../../features/report-card/components/BatchReportCards";
import { ReportExportLink } from "../../../../../features/reports/components/ReportExportLink";

export default function TeacherAdvisoryReportCardsPage() {
  const myClasses = useMyClasses();
  const advised = myClasses.data?.advisedSection;

  if (myClasses.isLoading) return <div className="h-32 animate-pulse rounded-xl bg-slate-200" />;

  if (!advised) {
    return (
      <RoleGuard allowedRoles={["TEACHER"]}>
        <DashboardLayout>
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            You are not assigned as an adviser to any section.
          </div>
        </DashboardLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout>
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Advisory report cards</h1>
          <p className="mt-1 text-sm text-slate-500">Grade {advised.gradeLevel} · {advised.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ReportExportLink report="section-class-list" filters={{ sectionId: advised.id, ...(advised.schoolYear?.id ? { schoolYearId: advised.schoolYear.id } : {}) }} locked={["sectionId", ...(advised.schoolYear?.id ? ["schoolYearId"] : [])]} label="Export class list" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" />
            <ReportExportLink report="section-grades" filters={{ sectionId: advised.id, ...(advised.schoolYear?.id ? { schoolYearId: advised.schoolYear.id } : {}) }} locked={["sectionId", ...(advised.schoolYear?.id ? ["schoolYearId"] : [])]} label="Export grades" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" />
          </div>
        </div>
        <BatchReportCards sectionId={advised.id} title={`Grade ${advised.gradeLevel} ${advised.name} report cards`} />
      </DashboardLayout>
    </RoleGuard>
  );
}
