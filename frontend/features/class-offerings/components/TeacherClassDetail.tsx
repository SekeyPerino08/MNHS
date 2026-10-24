"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, Search, Users } from "lucide-react";
import { ApiError } from "../../../lib/api";
import { EmptyState } from "../../../components/shared";
import { useClassOffering, useOfferingStudents } from "../hooks";

export function TeacherClassDetail({ offeringId }: Readonly<{ offeringId: string }>) {
  const offering = useClassOffering(offeringId);
  const roster = useOfferingStudents(offeringId);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => (roster.data ?? []).filter((student) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || `${student.studentNo} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`.toLocaleLowerCase().includes(query);
  }), [roster.data, search]);
  const forbidden = offering.error instanceof ApiError && (offering.error.status === 403 || offering.error.status === 404);
  if (forbidden) return <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center"><h1 className="text-xl font-semibold text-slate-900">You don’t have access to this class</h1><p className="mt-2 text-sm text-slate-500">The class may not exist or may not be assigned to your teacher account.</p><Link href="/teacher/classes" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft size={16} /> Back to my classes</Link></div>;
  if (offering.isLoading || roster.isLoading) return <div className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-9 w-52 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>;
  if (offering.isError || roster.isError || !offering.data) return <div className="mx-auto max-w-5xl rounded-2xl border border-rose-200 bg-white p-8 text-center"><h1 className="font-semibold text-slate-900">Could not load class</h1><p className="mt-1 text-sm text-slate-500">Please try again.</p><button type="button" onClick={() => { void offering.refetch(); void roster.refetch(); }} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div>;
  const item = offering.data;
  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/teacher/classes" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700"><ArrowLeft size={17} /> Back to my classes</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{item.subject.code}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{item.subject.name}</h1><p className="mt-2 text-slate-600">Grade {item.section.gradeLevel} · {item.section.name}</p><p className="mt-1 text-sm text-slate-500">Teacher: {item.teacher.lastName}, {item.teacher.firstName}</p></div><div className="flex flex-wrap gap-2"><Link href={`/teacher/classes/${offeringId}/attendance`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"><ClipboardCheck size={16} /> Attendance</Link><Link href={`/teacher/classes/${offeringId}/attendance/summary`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Attendance summary</Link></div></header>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Student roster</h2><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Users size={15} /> {roster.data?.length ?? 0} students</p></div><label className="relative w-full sm:max-w-xs"><span className="sr-only">Search roster</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></label></div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Student No</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Sex</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((student) => <tr key={student.id}><td className="px-5 py-3 font-medium">{student.studentNo}</td><td className="px-5 py-3">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</td><td className="px-5 py-3">{student.sex === "MALE" ? "Male" : "Female"}</td></tr>)}</tbody></table></div> : <EmptyState title={roster.data?.length ? "No students match your search" : "No students enrolled yet"} description={roster.data?.length ? "Try a different name or student number." : "The section roster is empty."} />}
    </section>
  </div>;
}
