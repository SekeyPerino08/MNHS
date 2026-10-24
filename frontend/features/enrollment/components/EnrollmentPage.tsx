"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useUrlState } from "../../../hooks/useUrlState";
import { DataTablePagination, EmptyState, ErrorState, Modal, StatusBadge, TableSkeleton } from "../../../components/shared";
import { useCurrentSchoolYear, useSchoolYears } from "../../school-years/hooks";
import { useSections } from "../../sections/hooks";
import { useBulkEnroll, useEnrollments, useUnassignedStudents } from "../hooks";
import type { EnrollmentRecord, UnassignedStudent } from "../types";
import { ChangeEnrollmentStatusDialog, EnrollmentStatusBadge, TransferEnrollmentDialog } from "./EnrollmentDialogs";

const defaults = { page: "1", pageSize: "10" };
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";

export function EnrollmentPage() {
  const url = useUrlState(defaults);
  const { values, update, updateSearch: setUrlSearch } = url;
  const currentYear = useCurrentSchoolYear();
  const schoolYears = useSchoolYears();
  const schoolYearId = values.schoolYearId || currentYear.data?.data.id;
  const sectionsQuery = useSections({ page: 1, pageSize: 100, schoolYearId });
  const sections = useMemo(() => sectionsQuery.data?.data ?? [], [sectionsQuery.data?.data]);
  const selectedSection = sections.find((section) => section.id === values.sectionId);
  const [tab, setTab] = useState<"enrolled" | "add">("enrolled");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [transfer, setTransfer] = useState<EnrollmentRecord | null>(null);
  const [status, setStatus] = useState<EnrollmentRecord | null>(null);
  const [bulkResults, setBulkResults] = useState<{
    enrolledCount: number;
    skipped: Array<{ studentId: string; studentName: string; reason: string; code?: string }>;
  } | null>(null);
  const bulkMutation = useBulkEnroll();
  const page = positive(values.page, 1);
  const pageSize = positive(values.pageSize, 10);
  const search = values.search || "";
  const enrollmentQuery = useEnrollments({
    page, pageSize, schoolYearId, sectionId: selectedSection?.id,
    search: search || undefined, sortBy: "lastName", order: "asc",
  }, Boolean(selectedSection) && tab === "enrolled");
  const unassignedQuery = useUnassignedStudents({
    page, pageSize, schoolYearId, search: search || undefined,
  }, Boolean(selectedSection) && tab === "add");

  useEffect(() => {
    if (currentYear.data?.data.id && !values.schoolYearId) {
      update({ schoolYearId: currentYear.data.data.id }, false);
    }
  }, [currentYear.data?.data.id, update, values.schoolYearId]);
  useEffect(() => {
    if (values.sectionId && !sections.some((section) => section.id === values.sectionId)) {
      update({ sectionId: null }, false);
    }
  }, [sections, update, values.sectionId]);

  function changeTab(next: "enrolled" | "add") {
    setTab(next);
    update({ page: 1 }, false);
  }
  function updateSearch(value: string) {
    setSelected(new Set());
    setSelectedNames({});
    setUrlSearch(value);
  }
  function toggleStudent(student: UnassignedStudent) {
    const next = new Set(selected);
    const names = { ...selectedNames };
    if (next.has(student.id)) {
      next.delete(student.id);
      delete names[student.id];
    } else {
      next.add(student.id);
      names[student.id] = studentName(student);
    }
    setSelected(next);
    setSelectedNames(names);
  }
  const pageStudents = unassignedQuery.data?.data ?? [];
  const allOnPageSelected = pageStudents.length > 0 && pageStudents.every((student) => selected.has(student.id));
  function toggleAllOnPage() {
    const next = new Set(selected);
    const names = { ...selectedNames };
    pageStudents.forEach((student) => {
      if (allOnPageSelected) {
        next.delete(student.id);
        delete names[student.id];
      } else {
        next.add(student.id);
        names[student.id] = studentName(student);
      }
    });
    setSelected(next);
    setSelectedNames(names);
  }
  async function submitBulk() {
    if (!selectedSection || !selected.size) return;
    try {
      const result = await bulkMutation.mutateAsync({ sectionId: selectedSection.id, studentIds: [...selected] });
      const skipped = result.skipped.map((item) => ({
        ...item,
        studentName: selectedNames[item.studentId] ?? item.studentId,
        reason: friendlySkippedReason(item.code, item.reason),
      }));
      setBulkResults({ enrolledCount: result.enrolled.length, skipped });
      setSelected(new Set());
      setSelectedNames({});
      toast.success(`${result.enrolled.length} student${result.enrolled.length === 1 ? "" : "s"} enrolled`);
    } catch {
      toast.error("Could not enroll selected students. Please try again.");
    }
  }

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Enrollment</h1><p className="mt-1 text-sm text-slate-500">Manage student enrollment and class placement.</p></div>
    </header>
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">School year
        <select value={schoolYearId ?? ""} onChange={(event) => { setSelected(new Set()); setSelectedNames({}); update({ schoolYearId: event.target.value || null, sectionId: null }); }} className={`${inputClass} mt-1`}>
          <option value="">Select school year</option>{schoolYears.data?.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">Section
        <select value={selectedSection?.id ?? ""} onChange={(event) => { setSelected(new Set()); setSelectedNames({}); update({ sectionId: event.target.value || null }); }} className={`${inputClass} mt-1`} disabled={!schoolYearId || sectionsQuery.isLoading}>
          <option value="">Select section</option>
          {[7, 8, 9, 10, 11, 12].map((grade) => {
            const gradeSections = sections.filter((section) => section.gradeLevel === grade);
            return gradeSections.length ? <optgroup key={grade} label={`Grade ${grade}`}>{gradeSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</optgroup> : null;
          })}
        </select>
      </label>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex gap-2" role="tablist" aria-label="Enrollment sections">
          <button type="button" role="tab" aria-selected={tab === "enrolled"} onClick={() => changeTab("enrolled")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "enrolled" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>Enrolled students</button>
          <button type="button" role="tab" aria-selected={tab === "add"} onClick={() => changeTab("add")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "add" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>Add students</button>
        </div>
        <label className="relative w-full sm:max-w-sm"><span className="sr-only">Search students</span><Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input key={values.search ?? ""} defaultValue={values.search ?? ""} onChange={(event) => updateSearch(event.target.value)} placeholder="Search name or student number" className={`${inputClass} pl-9`} /></label>
      </div>
      {!selectedSection ? <EmptyState title="Select a section to begin" description="Choose a school year and section to manage student enrollment." /> : tab === "enrolled" ? (
        enrollmentQuery.isError ? <ErrorState title="Could not load enrollments" error={enrollmentQuery.error} retry={() => void enrollmentQuery.refetch()} />
          : !enrollmentQuery.isLoading && !enrollmentQuery.data?.data.length ? <EmptyState title="No students enrolled yet" description="Use Add students to enroll active students in this section." />
            : <><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student No</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Sex</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Enrolled date</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              {enrollmentQuery.isLoading && !enrollmentQuery.data ? <TableSkeleton columns={6} rows={pageSize} /> : <tbody className="divide-y divide-slate-100">{enrollmentQuery.data?.data.map((enrollment) => <tr key={enrollment.id}>
                <td className="px-4 py-3">{enrollment.student.studentNo}</td><td className="px-4 py-3"><Link href={`/admin/students/${enrollment.student.id}`} className="font-medium text-indigo-700 hover:underline">{studentName(enrollment.student)}</Link></td><td className="px-4 py-3">{enrollment.student.sex ? humanSex(enrollment.student.sex) : "—"}</td><td className="px-4 py-3"><EnrollmentStatusBadge status={enrollment.status} /></td><td className="px-4 py-3">{formatDate(enrollment.enrolledAt)}</td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Link href={`/admin/students/${enrollment.student.id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">View</Link>{enrollment.status === "ENROLLED" && <button type="button" onClick={() => setTransfer(enrollment)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Transfer</button>}<button type="button" onClick={() => setStatus(enrollment)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Change status</button></div></td>
              </tr>)}</tbody>}</table></div>
              {enrollmentQuery.data && <DataTablePagination page={page} pageSize={pageSize} total={enrollmentQuery.data.meta.total} totalPages={enrollmentQuery.data.meta.totalPages} onPage={(next) => update({ page: next }, false)} onPageSize={(size) => update({ page: 1, pageSize: size }, false)} />}
            </>
      ) : unassignedQuery.isError ? <ErrorState title="Could not load unassigned students" error={unassignedQuery.error} retry={() => void unassignedQuery.refetch()} />
        : !unassignedQuery.isLoading && !unassignedQuery.data?.data.length ? <EmptyState title="Everyone is already enrolled" description="There are no active students without an enrollment for this school year." />
          : <><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all students on this page" checked={allOnPageSelected} onChange={toggleAllOnPage} /></th><th className="px-4 py-3">Student No</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Sex</th><th className="px-4 py-3">Status</th></tr></thead>
            {unassignedQuery.isLoading && !unassignedQuery.data ? <TableSkeleton columns={5} rows={pageSize} /> : <tbody className="divide-y divide-slate-100">{unassignedQuery.data?.data.map((student) => <tr key={student.id}><td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${studentName(student)}`} checked={selected.has(student.id)} onChange={() => toggleStudent(student)} /></td><td className="px-4 py-3">{student.studentNo}</td><td className="px-4 py-3 font-medium text-slate-900">{studentName(student)}</td><td className="px-4 py-3">{humanSex(student.sex)}</td><td className="px-4 py-3"><StatusBadge label="Active" color="green" /></td></tr>)}</tbody>}</table></div>
            {unassignedQuery.data && <DataTablePagination page={page} pageSize={pageSize} total={unassignedQuery.data.meta.total} totalPages={unassignedQuery.data.meta.totalPages} onPage={(next) => update({ page: next }, false)} onPageSize={(size) => update({ page: 1, pageSize: size }, false)} />}
            {selected.size > 0 && <div className="sticky bottom-3 z-10 mx-3 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-lg"><p className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Users size={18} /> {selected.size} selected</p><button type="button" disabled={bulkMutation.isPending} onClick={() => void submitBulk()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{bulkMutation.isPending ? "Enrolling…" : `Enroll in ${selectedSection.name}`} <Check size={16} /></button></div>}
          </>}
    </section>
    {transfer && selectedSection && <TransferEnrollmentDialog enrollment={transfer} schoolYearId={selectedSection.schoolYearId} currentSectionId={selectedSection.id} sections={sections} onClose={() => setTransfer(null)} />}
    {status && <ChangeEnrollmentStatusDialog enrollment={status} onClose={() => setStatus(null)} />}
    {bulkResults && <BulkResultsDialog enrolledCount={bulkResults.enrolledCount} skipped={bulkResults.skipped} onClose={() => setBulkResults(null)} />}
  </div>;
}

function BulkResultsDialog({ enrolledCount, skipped, onClose }: Readonly<{
  enrolledCount: number;
  skipped: Array<{ studentId: string; studentName: string; reason: string; code?: string }>;
  onClose: () => void;
}>) {
  return <Modal title="Enrollment results" onClose={onClose} size="max-w-lg">
    <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Enrolled</p><p className="mt-1 text-2xl font-bold text-emerald-800">{enrolledCount}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-700">Skipped</p><p className="mt-1 text-2xl font-bold text-amber-800">{skipped.length}</p></div></div>
      {skipped.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-slate-800">Skipped students</h3><ul className="max-h-60 space-y-2 overflow-y-auto">{skipped.map((item) => <li key={item.studentId} className="rounded-lg border border-slate-200 p-3 text-sm"><span className="font-medium">{item.studentName}</span><span className="block text-slate-600">{friendlySkippedReason(item.code, item.reason)}</span></li>)}</ul></div>}
      <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Done</button></div>
    </div>
  </Modal>;
}

function friendlySkippedReason(code?: string, reason?: string) {
  if (code === "STUDENT_NOT_ACTIVE") return "This student is not active and cannot be enrolled.";
  if (code === "ALREADY_ENROLLED") return reason || "This student is already enrolled for the school year.";
  if (code === "STUDENT_NOT_FOUND") return "The student record could not be found.";
  return reason || "The student could not be enrolled.";
}
function studentName(student: { firstName: string; middleName: string | null; lastName: string }) {
  return `${student.lastName}, ${student.firstName}${student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}`;
}
function humanSex(sex: "MALE" | "FEMALE") { return sex === "MALE" ? "Male" : "Female"; }
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
function positive(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
