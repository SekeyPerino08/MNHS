"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Mail, Pencil, Plus, UserRound } from "lucide-react";
import { ApiError } from "../../../lib/api";
import { useStudent } from "../hooks";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { QuickEnrollDialog } from "../../enrollment/components/EnrollmentDialogs";

export function StudentDetailView({ id }: Readonly<{ id: string }>) {
  const query = useStudent(id);
  const [dialog, setDialog] = useState<"edit" | "status" | "account" | "enrollment" | null>(null);

  if (query.isLoading) {
    return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-8 w-40 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-200" /><div className="grid gap-5 md:grid-cols-2"><div className="h-56 rounded-2xl bg-slate-200" /><div className="h-56 rounded-2xl bg-slate-200" /></div><div className="h-48 rounded-2xl bg-slate-200" /></div>;
  }

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/students" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to students</Link>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Student not found</h1>
          <p className="mt-2 text-sm text-slate-500">This student may have been removed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <h1 className="font-semibold text-slate-900">Could not load student</h1>
        <p className="mt-1 text-sm text-slate-500">{query.error instanceof Error ? query.error.message : "Please try again."}</p>
        <button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Retry</button>
      </div>
    );
  }

  const student = query.data;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/students" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to students</Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName}` : ""}</h1>
            <StudentStatusBadge status={student.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">Student number: <span className="font-medium text-slate-700">{student.studentNo}</span></p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setDialog("status")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Change status</button>
          <button type="button" onClick={() => setDialog("edit")} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Pencil size={16} /> Edit</button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <InfoCard title="Personal information" icon={<UserRound size={18} />}>
          <Detail label="Full name" value={`${student.firstName} ${student.middleName ? `${student.middleName} ` : ""}${student.lastName}`} />
          <Detail label="Sex" value={student.sex === "MALE" ? "Male" : "Female"} />
          <Detail label="Date of birth" value={formatDate(student.birthDate)} />
          <Detail label="Address" value={student.address} />
        </InfoCard>
        <InfoCard title="Guardian information" icon={<UserRound size={18} />}>
          <Detail label="Guardian name" value={student.guardianName} />
          <Detail label="Guardian contact" value={student.guardianContact} />
        </InfoCard>
        <InfoCard title="Login account" icon={<Mail size={18} />}>
          {student.user ? (
            <>
              <Detail label="Email" value={student.user.email} />
              <Detail label="Account status" value={student.user.isActive === undefined ? "Not provided by the API" : student.user.isActive ? "Active" : "Disabled"} />
            </>
          ) : (
            <div className="py-1">
              <p className="text-sm text-slate-500">No account yet</p>
              <button type="button" onClick={() => setDialog("account")} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"><Plus size={16} /> Create account</button>
            </div>
          )}
        </InfoCard>
        <InfoCard title="Current enrollment" icon={<CalendarDays size={18} />}>
          {student.currentEnrollment ? (
            <>
              <Detail label="School year" value={student.currentEnrollment.schoolYear.name} />
              <Detail label="Grade" value={student.currentEnrollment.section ? `Grade ${student.currentEnrollment.section.gradeLevel}` : null} />
              <Detail label="Section" value={student.currentEnrollment.section?.name} />
            </>
          ) : <div><p className="text-sm text-slate-500">Not currently enrolled.</p><button type="button" onClick={() => setDialog("enrollment")} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16} /> Enroll in a section</button></div>}
        </InfoCard>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Enrollment history</h2>
        </div>
        {student.enrollments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">School year</th><th className="px-5 py-3">Grade</th><th className="px-5 py-3">Section</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {student.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td className="px-5 py-3 font-medium text-slate-800">{enrollment.schoolYear.name}</td>
                    <td className="px-5 py-3 text-slate-600">{enrollment.section ? `Grade ${enrollment.section.gradeLevel}` : "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{enrollment.section?.name ?? "—"}</td>
                    <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{enrollment.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-6 text-sm text-slate-500">No enrollment history.</p>}
      </section>

      {dialog === "edit" && <StudentFormDialog student={student} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "status" && <ChangeStatusDialog studentId={student.id} currentStatus={student.status} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "account" && <CreateAccountDialog studentId={student.id} onClose={() => { setDialog(null); void query.refetch(); }} />}
      {dialog === "enrollment" && <QuickEnrollDialog studentId={student.id} onClose={() => { setDialog(null); void query.refetch(); }} />}
    </div>
  );
}

function InfoCard({ title, icon, children }: Readonly<{ title: string; icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><span className="text-indigo-600">{icon}</span>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value?: string | null }>) {
  return <div className="grid grid-cols-[130px_1fr] gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="break-words font-medium text-slate-800">{value || "—"}</span></div>;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
