"use client";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";
import { useSection } from "../hooks";
import { SectionFormDialog } from "./SectionFormDialog";
import type { Section } from "../types";

export function SectionDetail({ id }: Readonly<{ id: string }>) {
  const query = useSection(id); const [editing, setEditing] = useState(false);
  if (query.isLoading) return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-8 w-40 rounded bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-80 rounded-2xl bg-slate-200" /></div>;
  if (query.isError || !query.data) return <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-10 text-center"><h1 className="text-xl font-semibold">Section not found</h1><Link href="/admin/sections" className="mt-4 inline-block text-sm font-semibold text-indigo-600">Back to sections</Link></div>;
  const section = query.data;
  const editable = { ...section, _count: { enrollments: section.enrollments.length, classOfferings: section.classOfferings.length } };
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/admin/sections" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to sections</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-sm text-slate-500">{section.schoolYear?.name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Grade {section.gradeLevel} · {section.name}</h1><p className="mt-2 text-sm text-slate-600">Adviser: {section.adviser ? `${section.adviser.firstName} ${section.adviser.lastName}` : "No adviser"}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Pencil size={16} /> Edit</button><button type="button" disabled className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white opacity-60">Manage enrollment (coming soon)</button></div>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Enrolled students ({section.enrollments.length})</h2>{section.enrollments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Student No</th><th className="px-4 py-3">Name</th></tr></thead><tbody className="divide-y divide-slate-100">{section.enrollments.map((enrollment) => <tr key={enrollment.id}><td className="px-4 py-3">{enrollment.student.studentNo}</td><td className="px-4 py-3"><Link className="font-medium text-indigo-700 hover:underline" href={`/admin/students/${enrollment.student.id}`}>{enrollment.student.lastName}, {enrollment.student.firstName}{enrollment.student.middleName ? ` ${enrollment.student.middleName.charAt(0)}.` : ""}</Link></td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No enrolled students.</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Class offerings ({section.classOfferings.length})</h2>{section.classOfferings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Term</th></tr></thead><tbody className="divide-y divide-slate-100">{section.classOfferings.map((offering) => <tr key={offering.id}><td className="px-4 py-3">{offering.subject.code} · {offering.subject.name}</td><td className="px-4 py-3">{offering.teacher.lastName}, {offering.teacher.firstName}</td><td className="px-4 py-3">{offering.term.name}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No class offerings.</p>}</section>
    {editing && <SectionFormDialog section={editable as Section} onClose={() => setEditing(false)} />}
  </div>;
}
