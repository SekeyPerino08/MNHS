"use client";
import { useMemo, useState } from "react";
import { CirclePlus, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUrlState } from "../../../hooks/useUrlState";
import { ConfirmDialog, DataTablePagination, EmptyState, ErrorState, SortableHeader, TableSkeleton } from "../../../components/shared";
import { ApiError } from "../../../lib/api";
import { useDeleteSubject, useSubjects } from "../hooks";
import { SubjectFormDialog } from "./SubjectFormDialog";
import type { Subject, SubjectParams } from "../types";
const defaults = { page: "1", pageSize: "10", sortBy: "code", order: "asc" };
type Sort = SubjectParams["sortBy"];

export function SubjectsList() {
  const { values, update, updateSearch, clear } = useUrlState(defaults);
  const params = useMemo<SubjectParams>(() => ({
    page: positive(values.page, 1), pageSize: positive(values.pageSize, 10),
    search: values.search || undefined, gradeLevel: values.gradeLevel ? positive(values.gradeLevel, 7) : undefined,
    sortBy: values.sortBy === "name" ? "name" : "code", order: values.order === "desc" ? "desc" : "asc",
  }), [values]);
  const query = useSubjects(params); const deleteMutation = useDeleteSubject();
  const [editor, setEditor] = useState<Subject | null | "create">(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const filtered = Boolean(params.search || params.gradeLevel);
  function sort(key: Sort) { update({ sortBy: key, order: params.sortBy === key && params.order === "asc" ? "desc" : "asc" }, false); }
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError("");
    try { await deleteMutation.mutateAsync(deleting.id); toast.success("Subject deleted"); setDeleting(null); }
    catch (error) {
      if (error instanceof ApiError && error.code === "SUBJECT_IN_USE") {
        const count = typeof error.details === "object" && error.details !== null && "count" in error.details && typeof error.details.count === "number"
          ? error.details.count : undefined;
        setDeleteError(count === undefined
          ? "This subject is used by classes and cannot be deleted. Edit it instead."
          : `This subject is used by ${count} classes and cannot be deleted. Edit it instead.`);
      } else setDeleteError("Could not delete this subject. Please try again.");
    }
  }
  return <div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Subjects</h1><p className="mt-1 text-sm text-slate-500">Manage curriculum subjects by grade level.</p></div>
      <button type="button" onClick={() => setEditor("create")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><CirclePlus size={18} /> Add subject</button></header>
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-[minmax(250px,1fr)_180px_auto]">
      <label className="relative"><span className="sr-only">Search subjects</span><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input key={values.search ?? ""} defaultValue={values.search ?? ""} onChange={(event) => updateSearch(event.target.value)} placeholder="Search code or name" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></label>
      <label><span className="sr-only">Filter by grade</span><select value={values.gradeLevel ?? ""} onChange={(event) => update({ gradeLevel: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All grades</option>{[7,8,9,10,11,12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
      <button type="button" disabled={!filtered} onClick={clear} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-40">Clear filters</button>
    </div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{query.isError ? <ErrorState title="Could not load subjects" error={query.error} retry={() => void query.refetch()} />
      : !query.isLoading && !query.data?.data.length ? <EmptyState title="No subjects match your filters" description="Try adjusting the search or grade filter." action={filtered ? <button type="button" onClick={clear} className="text-sm font-semibold text-indigo-600">Clear filters</button> : undefined} />
        : <><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50"><tr>
          <SortableHeader label="Code" sortKey="code" current={params.sortBy} order={params.order} onSort={sort} /><SortableHeader label="Name" sortKey="name" current={params.sortBy} order={params.order} onSort={sort} />
          <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Grade level</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Used in</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
        </tr></thead>
        {query.isLoading && !query.data ? <TableSkeleton columns={5} rows={params.pageSize} /> : <tbody className="divide-y divide-slate-100">{query.data?.data.map((subject) => <tr key={subject.id} className="hover:bg-slate-50/70">
          <td className="px-4 py-4 font-semibold text-slate-800">{subject.code}</td><td className="px-4 py-4">{subject.name}</td><td className="px-4 py-4">Grade {subject.gradeLevel}</td><td className="px-4 py-4">{subject._count?.classOfferings ?? 0} classes</td>
          <td className="px-4 py-3 text-right"><button type="button" aria-label={`Edit ${subject.name}`} onClick={() => setEditor(subject)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={17} /></button>
            <button type="button" aria-label={`Delete ${subject.name}`} onClick={() => { setDeleteError(""); setDeleting(subject); }} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button></td>
        </tr>)}</tbody>}</table></div>
          <DataTablePagination page={params.page} pageSize={params.pageSize} total={query.data?.meta.total ?? 0} totalPages={query.data?.meta.totalPages ?? 0} onPage={(page) => update({ page }, false)} onPageSize={(pageSize) => update({ page: 1, pageSize }, false)} /></>}
    </section>
    {editor === "create" && <SubjectFormDialog onClose={() => setEditor(null)} />}
    {editor && editor !== "create" && <SubjectFormDialog subject={editor} onClose={() => setEditor(null)} />}
    {deleting && <ConfirmDialog title="Delete subject" destructive loading={deleteMutation.isPending} confirmLabel="Delete subject" onClose={() => setDeleting(null)} onConfirm={() => void confirmDelete()}
      description={<>{deleteError && <span role="alert" className="mb-3 block rounded-lg bg-rose-50 p-3 text-rose-800">{deleteError}</span>}Delete <strong>{deleting.code} · {deleting.name}</strong>? This cannot be undone.</>} />}
  </div>;
}
function positive(value: string | undefined, fallback: number) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : fallback; }
