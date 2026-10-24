"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap } from "lucide-react";
import { ErrorState } from "../../../components/shared";
import { ApiError } from "../../../lib/api";
import { useClassOffering } from "../../class-offerings/hooks";
import { useClassGradeSheet } from "../hooks";

export function GradeSheetView({ offeringId }: Readonly<{ offeringId: string }>) {
  const sheet = useClassGradeSheet(offeringId);
  const offering = useClassOffering(offeringId);

  const isAccessError = [sheet.error, offering.error].some(
    (error) => error instanceof ApiError && (error.status === 403 || error.status === 404),
  );

  if (isAccessError) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h1 className="text-xl font-semibold text-slate-900">You don’t have access to this class</h1>
        <p className="mt-2 text-sm text-slate-500">The class may not exist or may not be assigned to your account.</p>
        <Link href="/teacher/classes" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <ArrowLeft size={16} /> Back to classes
        </Link>
      </div>
    );
  }

  if (sheet.isLoading || offering.isLoading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (sheet.isError || offering.isError || !offering.data || !sheet.data) {
    return (
      <ErrorState
        title="Could not load the grade sheet"
        error={sheet.error ?? offering.error}
        retry={() => {
          void sheet.refetch();
          void offering.refetch();
        }}
      />
    );
  }

  const item = offering.data;
  const terms = sheet.data.terms;
  const roster = sheet.data.roster;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={`/teacher/classes/${offeringId}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-700">
        <ArrowLeft size={17} /> Back to class
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{item.subject.code}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{item.subject.name}</h1>
          <p className="mt-2 text-slate-600">Grade {item.section.gradeLevel} · {item.section.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <BookOpen size={15} /> {terms.length} terms
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <GraduationCap size={15} /> {roster.length} students
          </span>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                {terms.map((term) => (
                  <th key={term.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-slate-700">{term.name}</div>
                    <div className="mt-1 text-[10px] uppercase text-slate-400">
                      {term.gradesLocked ? "Locked" : "Open"}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Final grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => (
                <tr key={student.studentId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{student.lastName}, {student.firstName}{student.middleName ? ` ${student.middleName.charAt(0)}.` : ""}</div>
                    <div className="text-xs text-slate-500">{student.studentNo}</div>
                  </td>
                  {terms.map((term) => {
                    const value = student.scores[term.id];
                    const descriptor = student.remarks[term.id] ?? null;
                    return (
                      <td key={`${student.studentId}-${term.id}`} className="px-3 py-3 text-center">
                        <div className="font-semibold text-slate-800">{value === null || value === undefined ? "—" : value.toFixed(0)}</div>
                        {descriptor ? <div className="mt-1 text-[11px] text-slate-500">{descriptor}</div> : null}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <div className="font-bold text-slate-900">{student.finalGrade === null ? "—" : student.finalGrade}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{student.descriptor ?? "—"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
