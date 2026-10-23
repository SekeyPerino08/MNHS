"use client";
import { useState } from "react";
import { CirclePlus, Pencil, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ErrorState, StatusBadge } from "../../../components/shared";
import { friendlyApiMessage } from "../../../components/shared";
import { useSchoolYears, useSetCurrentSchoolYear } from "../hooks";
import type { SchoolYear, Term } from "../types";
import { SchoolYearFormDialog } from "./SchoolYearFormDialog";
import { TermFormDialog } from "./TermFormDialog";

export function SchoolYearsList() {
  const query = useSchoolYears(); const setCurrent = useSetCurrentSchoolYear();
  const [editingYear, setEditingYear] = useState<SchoolYear | "create" | null>(null);
  const [editingTerm, setEditingTerm] = useState<{ year: SchoolYear; term: Term } | null>(null);
  const [confirmYear, setConfirmYear] = useState<SchoolYear | null>(null);
  if (query.isError) return <ErrorState title="Could not load school years" error={query.error} retry={() => void query.refetch()} />;
  return <div className="mx-auto max-w-5xl">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-900">School Years</h1><p className="mt-1 text-sm text-slate-500">Manage academic year dates and terms.</p></div>
      <button type="button" onClick={() => setEditingYear("create")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><CirclePlus size={18} /> Add school year</button></header>
    {query.isLoading ? <div className="space-y-5">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      : query.data?.data.length ? <div className="space-y-5">{query.data.data.map((year) => <article key={year.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><CalendarDays size={20} /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-900">{year.name}</h2>{year.isCurrent && <StatusBadge label="Current" color="green" />}</div><p className="mt-1 text-sm text-slate-500">{date(year.startDate)} – {date(year.endDate)}</p></div></div>
          <div className="flex gap-2"><button type="button" onClick={() => setEditingYear(year)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Pencil size={15} /> Edit</button>
            {!year.isCurrent && <button type="button" disabled={setCurrent.isPending} onClick={() => setConfirmYear(year)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Set as current</button>}</div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Term</th><th className="px-4 py-3">Start date</th><th className="px-4 py-3">End date</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{[...year.terms].sort((a,b) => a.termNumber-b.termNumber).map((term) => <tr key={term.id}><td className="px-4 py-3">{term.termNumber}</td><td className="px-4 py-3 font-medium">{term.name}</td><td className="px-4 py-3 text-slate-600">{date(term.startDate)}</td><td className="px-4 py-3 text-slate-600">{date(term.endDate)}</td><td className="px-4 py-3 text-right"><button type="button" aria-label={`Edit ${term.name}`} onClick={() => setEditingTerm({ year, term })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button></td></tr>)}</tbody></table></div>
      </article>)}</div> : <div className="rounded-2xl border border-slate-200 bg-white"><div className="p-10 text-center text-sm text-slate-500">No school years have been configured.</div></div>}
    {editingYear === "create" && <SchoolYearFormDialog onClose={() => setEditingYear(null)} />}
    {editingYear && editingYear !== "create" && <SchoolYearFormDialog year={editingYear} onClose={() => setEditingYear(null)} />}
    {editingTerm && <TermFormDialog year={editingTerm.year} term={editingTerm.term} onClose={() => setEditingTerm(null)} />}
    {confirmYear && <ConfirmDialog title="Change current school year" loading={setCurrent.isPending} confirmLabel="Set as current" onClose={() => setConfirmYear(null)} onConfirm={() => {
      void setCurrent.mutateAsync(confirmYear.id).then(() => { toast.success(`${confirmYear.name} is now the current school year`); setConfirmYear(null); })
        .catch((error: unknown) => toast.error(friendlyApiMessage(error, "Could not change the current school year")));
    }} description={<span>Setting <strong>{confirmYear.name}</strong> as current changes the active year across the whole system, including default filters and new enrollments.</span>} />}
  </div>;
}
function date(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
