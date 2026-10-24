"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { ErrorState } from "../../../components/shared";
import { useMyClasses } from "../../class-offerings/hooks";

export function TeacherGradesOverview() {
  const query = useMyClasses();

  if (query.isLoading) {
    return <div className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /><div className="h-40 rounded-2xl bg-slate-200" /></div>;
  }

  if (query.isError) {
    return <ErrorState title="Could not load your classes" error={query.error} retry={() => void query.refetch()} />;
  }

  const classes = query.data?.data ?? [];

  if (!classes.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No class assignments are available for grade entry yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {classes.map((offering) => (
        <article key={offering.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{offering.subject.code}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{offering.subject.name}</h2>
            </div>
            <span className="rounded-xl bg-indigo-50 p-2 text-indigo-700"><GraduationCap size={18} aria-hidden="true" /></span>
          </div>
          <p className="mt-4 text-sm text-slate-600">Grade {offering.section.gradeLevel} · {offering.section.name}</p>
          <p className="mt-2 text-sm text-slate-500">{offering.enrolledStudentCount} students</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/teacher/classes/${offering.id}/grades`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              <BookOpen size={15} /> Grade sheet
            </Link>
            <Link href={`/teacher/classes/${offering.id}/attendance`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ClipboardCheck size={15} /> Attendance
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
