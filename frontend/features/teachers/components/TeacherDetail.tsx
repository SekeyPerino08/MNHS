"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { StatusBadge } from "../../../components/shared";
import { useTeacher } from "../hooks";
import { TeacherFormDialog } from "./TeacherFormDialog";
import { TeacherStatusDialog } from "./TeacherStatusDialog";
import { useState } from "react";
import type { Teacher } from "../types";

export function TeacherDetail({ id }: Readonly<{ id: string }>) {
  const query = useTeacher(id);
  const [dialog, setDialog] = useState<"edit" | "status" | null>(null);
  if (query.isLoading) return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-8 w-40 rounded bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>;
  if (query.isError || !query.data) return <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-10 text-center"><h1 className="text-xl font-semibold">Teacher not found</h1><Link href="/admin/teachers" className="mt-4 inline-block text-sm font-semibold text-indigo-600">Back to teachers</Link></div>;
  const teacher = query.data;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/admin/teachers" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to teachers</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><p className="text-sm text-slate-500">{teacher.employeeNo}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{teacher.firstName} {teacher.middleName ? `${teacher.middleName} ` : ""}{teacher.lastName}</h1><div className="mt-3"><StatusBadge label={teacher.isActive ? "Active" : "Inactive"} color={teacher.isActive ? "green" : "gray"} /></div></div>
      <div className="flex gap-2"><button type="button" onClick={() => setDialog("edit")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Pencil size={16} /> Edit</button><button type="button" onClick={() => setDialog("status")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{teacher.isActive ? "Deactivate" : "Activate"}</button></div>
    </header>
    <div className="grid gap-5 md:grid-cols-2">
      <Card title="Teacher information"><Detail label="Department" value={teacher.department} /><Detail label="Contact" value={teacher.contactNo} /><Detail label="Employee No" value={teacher.employeeNo} /></Card>
      <Card title="Login account">{teacher.user ? <><Detail label="Email" value={teacher.user.email} /><Detail label="Account status" value={teacher.isActive ? "Active" : "Disabled"} /></> : <p className="text-sm text-slate-500">No account linked</p>}</Card>
    </div>
    <Card title="Current class offerings">
      {teacher.offerings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Grade & section</th></tr></thead><tbody className="divide-y divide-slate-100">{teacher.offerings.map((offering) => <tr key={offering.id}><td className="px-3 py-3">{offering.subject.code} · {offering.subject.name}</td><td className="px-3 py-3">Grade {offering.section.gradeLevel} · {offering.section.name}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No current class offerings.</p>}
    </Card>
    <Card title="Advised section">{teacher.advisedSections.length ? <ul className="space-y-2">{teacher.advisedSections.map((section) => <li key={section.id} className="text-sm text-slate-700">Grade {section.gradeLevel} · {section.name}</li>)}</ul> : <p className="text-sm text-slate-500">No section assigned.</p>}</Card>
    {dialog === "edit" && <TeacherFormDialog teacher={teacher as Teacher} onClose={() => setDialog(null)} />}
    {dialog === "status" && <TeacherStatusDialog teacher={teacher} onClose={() => setDialog(null)} />}
  </div>;
}

function Card({ title, children }: React.PropsWithChildren<{ title: string }>) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">{title}</h2>{children}</section>; }
function Detail({ label, value }: { label: string; value: string | null | undefined }) { return <div className="mb-3 flex justify-between gap-4 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{value || "—"}</span></div>; }
