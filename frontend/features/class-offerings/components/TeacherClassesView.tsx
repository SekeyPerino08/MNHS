"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, Users } from "lucide-react";
import { ErrorState, EmptyState } from "../../../components/shared";
import { useMyClasses } from "../hooks";
import type { ClassOfferingRecord } from "../../enrollment/types";

export function TeacherClassesView() {
  const query = useMyClasses();
  if (query.isLoading) return <div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-10 w-64 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-56 rounded-2xl bg-slate-200" />)}</div></div>;
  if (query.isError) return <ErrorState title="Could not load your classes" error={query.error} retry={() => void query.refetch()} />;
  const classes = query.data?.data ?? [];
  const advised = query.data?.advisedSection;
  const advisoryOffering = advised ? classes.find((offering) => offering.section.id === advised.id) : undefined;
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Teaching</p><h1 className="mt-1 text-3xl font-bold text-slate-900">My Classes</h1><p className="mt-1 text-sm text-slate-500">Your class assignments for the current school year.</p><p className="mt-1 text-sm font-medium text-indigo-700">Choose a class to take attendance.</p></header>
    {advised && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><div><p className="font-semibold text-indigo-950">You are the adviser of Grade {advised.gradeLevel} · {advised.name}</p><p className="mt-1 text-sm text-indigo-800">View the enrolled student roster for this section.</p></div>{advisoryOffering ? <Link href={`/teacher/classes/${advisoryOffering.id}`} className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">Open roster</Link> : <span className="text-sm text-indigo-700">No class roster link is available yet.</span>}</aside>}
    {!classes.length ? <EmptyState title="No classes assigned yet" description="Contact the administrator to be assigned to a class." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{classes.map((item) => <ClassCard key={item.id} offering={item} />)}</div>}
  </div>;
}

export function ClassCard({ offering }: Readonly<{ offering: ClassOfferingRecord & { enrolledStudentCount: number } }>) {
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{offering.subject.code}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{offering.subject.name}</h2></div><span className="rounded-xl bg-indigo-50 p-2 text-indigo-700"><BookOpen size={19} aria-hidden="true" /></span></div>
    <p className="mt-4 text-sm text-slate-600">Grade {offering.section.gradeLevel} · {offering.section.name}</p>
    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Users size={16} aria-hidden="true" /> {offering.enrolledStudentCount} students</p>
    <Link href={`/teacher/classes/${offering.id}`} className="mt-5 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700">View class</Link>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Link href={`/teacher/classes/${offering.id}/attendance`} aria-label={`Take attendance for ${offering.subject.name}, Grade ${offering.section.gradeLevel} ${offering.section.name}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-indigo-200 px-2 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"><ClipboardCheck size={15} /> Attendance</Link>
      <button type="button" disabled title="Coming soon" aria-label="Grades coming soon" className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-400"><BookOpen size={15} /> Grades <span className="sr-only">Coming soon</span></button>
    </div>
    <Link href={`/teacher/classes/${offering.id}/attendance/summary`} className="mt-3 self-start text-xs font-semibold text-slate-600 underline-offset-2 hover:text-indigo-700 hover:underline">Attendance summary</Link>
  </article>;
}
