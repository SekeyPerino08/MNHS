"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CirclePlus, Ellipsis, Eye, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUrlState } from "../../../hooks/useUrlState";
import { ApiError } from "../../../lib/api";
import { ConfirmDialog, DataTablePagination, EmptyState, ErrorState, TableSkeleton } from "../../../components/shared";
import { useCurrentSchoolYear, useSchoolYears } from "../../school-years/hooks";
import { useDeleteSection, useSections } from "../hooks";
import type { Section } from "../types";
import { SectionFormDialog } from "./SectionFormDialog";

const defaults = { page: "1", pageSize: "10" };
export function SectionsList() {
  const { values, update, updateSearch, clear } = useUrlState(defaults);
  const current = useCurrentSchoolYear(); const years = useSchoolYears();
  const activeYearId = values.schoolYearId || current.data?.data.id;
  useEffect(() => {
    if (current.data?.data.id && !values.schoolYearId) update({ schoolYearId: current.data.data.id }, false);
  }, [current.data?.data.id, update, values.schoolYearId]);
  const params = useMemo(() => ({
    page: positive(values.page, 1), pageSize: positive(values.pageSize, 10),
    search: values.search || undefined, schoolYearId: activeYearId,
    gradeLevel: values.gradeLevel ? positive(values.gradeLevel, 7) : undefined,
  }), [activeYearId, values]);
  const query = useSections(params); const deleteMutation = useDeleteSection();
  const [editor, setEditor] = useState<Section | "create" | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const filtered = Boolean(params.search || params.gradeLevel);
  async function deleteSelected() {
    if (!deleting) return;
    setDeleteError("");
    try { await deleteMutation.mutateAsync(deleting.id); toast.success("Section deleted"); setDeleting(null); }
    catch (error) {
      if (error instanceof ApiError && error.code === "SECTION_IN_USE") {
        const details = error.details as { enrollmentCount?: number; classOfferingCount?: number } | undefined;
        setDeleteError(`Section is in use: ${details?.enrollmentCount ?? 0} students and ${details?.classOfferingCount ?? 0} classes. Remove these records before deleting.`);
      } else setDeleteError("Could not delete this section. Please try again.");
    }
  }
  return <div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Sections</h1><p className="mt-1 text-sm text-slate-500">Manage grade-level sections and advisers.</p></div>
      <button type="button" onClick={() => setEditor("create")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><CirclePlus size={18} /> Add section</button></header>
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_220px_180px_auto]">
      <label><span className="sr-only">School year</span><select value={activeYearId ?? ""} onChange={(event) => update({ schoolYearId: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">{years.data?.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}</select></label>
      <label className="relative"><span className="sr-only">Search sections</span><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input key={values.search ?? ""} defaultValue={values.search ?? ""} onChange={(event) => updateSearch(event.target.value)} placeholder="Search section name" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></label>
      <label><span className="sr-only">Grade level</span><select value={values.gradeLevel ?? ""} onChange={(event) => update({ gradeLevel: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All grades</option>{[7,8,9,10,11,12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
      <button type="button" disabled={!filtered} onClick={clear} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-40">Clear filters</button>
    </div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{query.isError ? <ErrorState title="Could not load sections" error={query.error} retry={() => void query.refetch()} />
      : !query.isLoading && !query.data?.data.length ? <EmptyState title="No sections match your filters" description="Try adjusting the search or filters." action={filtered ? <button type="button" onClick={clear} className="text-sm font-semibold text-indigo-600">Clear filters</button> : undefined} />
        : <><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Section</th><th className="px-4 py-3">Adviser</th><th className="px-4 py-3">Students</th><th className="px-4 py-3">Subjects/classes</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          {query.isLoading && !query.data ? <TableSkeleton columns={6} rows={params.pageSize} /> : <tbody className="divide-y divide-slate-100">{query.data?.data.map((section) => <tr key={section.id} className="hover:bg-slate-50/70">
            <td className="px-4 py-4">Grade {section.gradeLevel}</td><td className="px-4 py-4"><Link href={`/admin/sections/${section.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">{section.name}</Link></td>
            <td className="px-4 py-4">{section.adviser ? `${section.adviser.lastName}, ${section.adviser.firstName}` : "—"}</td><td className="px-4 py-4">{section._count?.enrollments ?? 0}</td><td className="px-4 py-4">{section._count?.classOfferings ?? 0}</td>
            <td className="relative px-4 py-3 text-right"><button type="button" aria-label={`Actions for Grade ${section.gradeLevel} ${section.name}`} aria-expanded={menu === section.id} onClick={() => setMenu(menu === section.id ? null : section.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Ellipsis size={19} /></button>
              {menu === section.id && <div role="menu" className="absolute right-8 top-12 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg"><Link role="menuitem" href={`/admin/sections/${section.id}`} onClick={() => setMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Eye size={16} /> View</Link><button role="menuitem" type="button" onClick={() => { setEditor(section); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Pencil size={16} /> Edit</button><button role="menuitem" type="button" onClick={() => { setDeleting(section); setDeleteError(""); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"><Trash2 size={16} /> Delete</button></div>}</td>
          </tr>)}</tbody>}</table></div>
          <DataTablePagination page={params.page} pageSize={params.pageSize} total={query.data?.meta.total ?? 0} totalPages={query.data?.meta.totalPages ?? 0} onPage={(page) => update({ page }, false)} onPageSize={(pageSize) => update({ page: 1, pageSize }, false)} /></>}
    </section>
    {editor === "create" && <SectionFormDialog onClose={() => setEditor(null)} />}
    {editor && editor !== "create" && <SectionFormDialog section={editor} onClose={() => setEditor(null)} />}
    {deleting && <ConfirmDialog title="Delete section" destructive loading={deleteMutation.isPending} confirmLabel="Delete section" onClose={() => setDeleting(null)} onConfirm={() => void deleteSelected()} description={<>{deleteError && <span role="alert" className="mb-3 block rounded-lg bg-rose-50 p-3 text-rose-800">{deleteError}</span>}Delete Grade {deleting.gradeLevel} · {deleting.name}? This action cannot be undone.</>} />}
  </div>;
}
function positive(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
