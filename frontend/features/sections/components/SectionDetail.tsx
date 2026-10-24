"use client";
import Link from "next/link";
import { ArrowLeft, EllipsisVertical, Pencil, Users } from "lucide-react";
import { useState } from "react";
import type { EnrollmentRecord } from "../../enrollment/types";
import { ChangeEnrollmentStatusDialog, EnrollmentStatusBadge, TransferEnrollmentDialog } from "../../enrollment/components/EnrollmentDialogs";
import { SectionClassesManager } from "../../class-offerings/components/SectionClassesManager";
import { useSection, useSections } from "../hooks";
import { SectionFormDialog } from "./SectionFormDialog";
import type { Section } from "../types";
import { ReportExportLink } from "../../reports/components/ReportExportLink";

export function SectionDetail({ id }: Readonly<{ id: string }>) {
  const query = useSection(id); const [editing, setEditing] = useState(false);
  const [transferEnrollment, setTransferEnrollment] = useState<EnrollmentRecord | null>(null);
  const [statusEnrollment, setStatusEnrollment] = useState<EnrollmentRecord | null>(null);
  if (query.isLoading) return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-8 w-40 rounded bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-80 rounded-2xl bg-slate-200" /></div>;
  if (query.isError || !query.data) return <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-10 text-center"><h1 className="text-xl font-semibold">Section not found</h1><Link href="/admin/sections" className="mt-4 inline-block text-sm font-semibold text-indigo-600">Back to sections</Link></div>;
  const section = query.data;
  const editable = { ...section, _count: { enrollments: section.enrollments.length, classOfferings: section.classOfferings.length } };
  const mappedEnrollment = (item: Section["id"] extends string ? (typeof section.enrollments)[number] : never): EnrollmentRecord => ({
    id: item.id,
    studentId: item.student.id,
    schoolYearId: section.schoolYearId,
    sectionId: section.id,
    status: item.status as EnrollmentRecord["status"],
    enrolledAt: "",
    student: item.student,
    section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
    schoolYear: section.schoolYear,
  });
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/admin/sections" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to sections</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-sm text-slate-500">{section.schoolYear?.name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Grade {section.gradeLevel} · {section.name}</h1><p className="mt-2 text-sm text-slate-600">Adviser: {section.adviser ? `${section.adviser.firstName} ${section.adviser.lastName}` : "No adviser"}</p></div>
      <div className="flex flex-wrap gap-2"><ReportExportLink report="section-class-list" filters={{ sectionId: section.id, schoolYearId: section.schoolYearId }} locked={["sectionId", "schoolYearId"]} label="Export class list" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /><ReportExportLink report="section-grades" filters={{ sectionId: section.id, schoolYearId: section.schoolYearId }} locked={["sectionId", "schoolYearId"]} label="Export grades" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" /><button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Pencil size={16} /> Edit</button><Link href={`/admin/enrollment?schoolYearId=${encodeURIComponent(section.schoolYearId)}&sectionId=${encodeURIComponent(section.id)}`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"><Users size={16} /> Manage enrollment</Link></div>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Enrolled students ({section.enrollments.length})</h2>{section.enrollments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student No</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{section.enrollments.map((enrollment) => { const record = mappedEnrollment(enrollment); return <tr key={enrollment.id}><td className="px-4 py-3">{enrollment.student.studentNo}</td><td className="px-4 py-3"><Link className="font-medium text-indigo-700 hover:underline" href={`/admin/students/${enrollment.student.id}`}>{enrollment.student.lastName}, {enrollment.student.firstName}{enrollment.student.middleName ? ` ${enrollment.student.middleName.charAt(0)}.` : ""}</Link></td><td className="px-4 py-3"><EnrollmentStatusBadge status={record.status} /></td><td className="px-4 py-3 text-right"><details className="group relative inline-block text-left"><summary aria-label={`Actions for ${enrollment.student.firstName} ${enrollment.student.lastName}`} className="inline-flex cursor-pointer list-none rounded-lg p-2 text-slate-500 hover:bg-slate-100"><EllipsisVertical size={18} aria-hidden="true" /></summary><div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg"><button type="button" onClick={() => setTransferEnrollment(record)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Transfer</button><button type="button" onClick={() => setStatusEnrollment(record)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Change status</button></div></details></td></tr>; })}</tbody></table></div> : <p className="text-sm text-slate-500">No enrolled students.</p>}</section>
    <SectionClassesManager section={section} />
    {editing && <SectionFormDialog section={editable as Section} onClose={() => setEditing(false)} />}
    {transferEnrollment && <TransferDialogForSection enrollment={transferEnrollment} section={section} onClose={() => setTransferEnrollment(null)} />}
    {statusEnrollment && <ChangeEnrollmentStatusDialog enrollment={statusEnrollment} onClose={() => setStatusEnrollment(null)} />}
  </div>;
}

function TransferDialogForSection({ enrollment, section, onClose }: Readonly<{
  enrollment: EnrollmentRecord;
  section: import("../types").SectionDetail;
  onClose: () => void;
}>) {
  const sections = useSections({ page: 1, pageSize: 100, schoolYearId: section.schoolYearId });
  return <TransferEnrollmentDialog enrollment={enrollment} schoolYearId={section.schoolYearId} currentSectionId={section.id} sections={sections.data?.data ?? []} onClose={onClose} />;
}
