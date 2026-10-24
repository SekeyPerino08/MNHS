"use client";

import Link from "next/link";
import { BarChart3, GraduationCap, Sparkles } from "lucide-react";
import { ErrorState } from "../../../components/shared";
import { useMyGrades } from "../hooks";

export function MyGradesView() {
  const grades = useMyGrades();

  if (grades.isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-24 rounded-2xl bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>;
  }

  if (grades.isError) {
    return <ErrorState title="Could not load your grades" error={grades.error} retry={() => void grades.refetch()} />;
  }

  const data = grades.data;
  const subjects = data?.subjects ?? [];
  const generalAverageLabel = data && data.generalAverage !== null ? `${data.generalAverage.toFixed(2)}%` : "N/A";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">My grades</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{data?.schoolYear.name ?? "Current school year"}</h1>
            <p className="mt-1 text-sm text-slate-500">Released grades and final averages for your subjects.</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-4 py-3 text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">General average</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{generalAverageLabel}</div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Subjects" value={String(subjects.length)} icon={<BarChart3 size={18} />} />
        <StatCard label="Released finals" value={String(subjects.filter((subject) => subject.finalGrade !== null).length)} icon={<GraduationCap size={18} />} />
        <StatCard label="Passing" value={String(subjects.filter((subject) => subject.passing).length)} icon={<Sparkles size={18} />} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Subject overview</h2>
        </div>
        {subjects.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Terms</th>
                  <th className="px-4 py-3">Final grade</th>
                  <th className="px-4 py-3">Descriptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{subject.name}</div>
                      <div className="text-xs text-slate-500">{subject.sectionName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {subject.terms.map((term) => (
                          <span key={term.id} className={`rounded-full border px-2 py-1 text-[11px] font-medium ${term.score === null ? "border-slate-200 bg-slate-50 text-slate-500" : term.locked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                            {term.name}: {term.score === null ? "—" : term.score.toFixed(0)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{subject.finalGrade === null ? "N/A" : `${subject.finalGrade.toFixed(0)}`}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${subject.passing ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                        {subject.descriptor ?? "Not released"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No grades have been released yet for this school year.</div>
        )}
      </section>

      <p className="text-sm text-slate-500">
        Grade formula: final grade is computed from the four quarterly marks, and the general average counts only subjects with a released final grade.
      </p>
      <div className="text-sm text-slate-600">
        <Link href="/student/subjects" className="font-semibold text-indigo-700 hover:underline">Back to my subjects</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: Readonly<{ label: string; value: string; icon: React.ReactNode }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">{icon}</span>
      </div>
      <p className="mt-5 text-2xl font-bold text-slate-900">{value}</p>
    </section>
  );
}
