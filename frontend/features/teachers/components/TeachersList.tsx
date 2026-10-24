"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CirclePlus, Ellipsis, Eye, Pencil, Search, UserRoundPlus, UserRoundX } from "lucide-react";
import { useUrlState } from "../../../hooks/useUrlState";
import { DataTablePagination, EmptyState, ErrorState, SortableHeader, StatusBadge, TableSkeleton } from "../../../components/shared";
import { TeacherFormDialog } from "./TeacherFormDialog";
import { TeacherStatusDialog } from "./TeacherStatusDialog";
import { useCreateTeacherAccount, useTeachers } from "../hooks";
import type { Teacher, TeacherListParams } from "../types";
import { CreateAccountDialog } from "../../../components/shared";

const defaults = { page: "1", pageSize: "10", sortBy: "lastName", order: "asc" };
type SortKey = TeacherListParams["sortBy"];

export function TeachersList() {
  const { values, update, updateSearch, clear } = useUrlState(defaults);
  const params = useMemo<TeacherListParams>(() => ({
    page: positive(values.page, 1),
    pageSize: positive(values.pageSize, 10),
    search: values.search || undefined,
    isActive: values.isActive === "true" ? true : values.isActive === "false" ? false : undefined,
    sortBy: ["lastName", "employeeNo", "createdAt"].includes(values.sortBy ?? "") ? values.sortBy as SortKey : "lastName",
    order: values.order === "desc" ? "desc" : "asc",
  }), [values]);
  const query = useTeachers(params);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [dialog, setDialog] = useState<"create" | "edit" | "status" | "account" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const account = useCreateTeacherAccount();
  const response = query.data;
  const filtered = Boolean(params.search || params.isActive !== undefined);
  function close() { setDialog(null); setSelected(null); }
  function sort(key: SortKey) {
    update({ sortBy: key, order: params.sortBy === key && params.order === "asc" ? "desc" : "asc" }, false);
  }

  return <div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Teachers</h1><p className="mt-1 text-sm text-slate-500">Manage teacher records and login access.</p></div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/imports?type=teachers" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Import CSV</Link>
        <button type="button" onClick={() => setDialog("create")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><CirclePlus size={18} /> Add teacher</button>
      </div>
    </header>
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[minmax(250px,1fr)_200px_auto]">
        <label className="relative"><span className="sr-only">Search teachers</span><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input key={values.search ?? ""} defaultValue={values.search ?? ""} onChange={(event) => updateSearch(event.target.value)} placeholder="Search name, employee no, department" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500" /></label>
        <label><span className="sr-only">Filter by status</span><select value={values.isActive ?? ""} onChange={(event) => update({ isActive: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <button type="button" disabled={!filtered} onClick={clear} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-40">Clear filters</button>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {query.isError ? <ErrorState title="Could not load teachers" error={query.error} retry={() => void query.refetch()} />
        : !query.isLoading && !response?.data.length ? <EmptyState title="No teachers match your filters" description="Try changing your search or status filter." action={filtered ? <button type="button" onClick={clear} className="text-sm font-semibold text-indigo-600">Clear filters</button> : undefined} />
          : <><div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="bg-slate-50"><tr>
              <SortableHeader label="Employee No" sortKey="employeeNo" current={params.sortBy} order={params.order} onSort={sort} />
              <SortableHeader label="Name" sortKey="lastName" current={params.sortBy} order={params.order} onSort={sort} />
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Department</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Contact</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Classes</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Advisory section</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Account</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Status</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr></thead>
            {query.isLoading && !response ? <TableSkeleton columns={9} rows={params.pageSize} /> :
              <tbody className="divide-y divide-slate-100">{response?.data.map((teacher) => <tr key={teacher.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{teacher.employeeNo}</td>
                <td className="whitespace-nowrap px-4 py-4"><Link href={`/admin/teachers/${teacher.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">{teacher.lastName}, {teacher.firstName}{teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}</Link></td>
                <td className="px-4 py-4 text-slate-600">{teacher.department || "—"}</td><td className="px-4 py-4 text-slate-600">{teacher.contactNo || "—"}</td>
                <td className="px-4 py-4 text-slate-600">{teacher.classOfferingCount}</td>
                <td className="px-4 py-4 text-slate-600">{teacher.advisedSectionCount ? `${teacher.advisedSectionCount} section${teacher.advisedSectionCount === 1 ? "" : "s"}` : "—"}</td>
                <td className="px-4 py-4"><StatusBadge label={teacher.hasAccount ? "Has login" : "No login"} color={teacher.hasAccount ? "green" : "gray"} /></td>
                <td className="px-4 py-4"><StatusBadge label={teacher.isActive ? "Active" : "Inactive"} color={teacher.isActive ? "green" : "gray"} /></td>
                <td className="relative px-4 py-3 text-right">
                  <button type="button" aria-label={`Actions for ${teacher.firstName} ${teacher.lastName}`} aria-expanded={menu === teacher.id} onClick={() => setMenu(menu === teacher.id ? null : teacher.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Ellipsis size={19} /></button>
                  {menu === teacher.id && <div role="menu" className="absolute right-8 top-12 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg">
                    <Link role="menuitem" href={`/admin/teachers/${teacher.id}`} onClick={() => setMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Eye size={16} /> View</Link>
                    <button role="menuitem" type="button" onClick={() => { setSelected(teacher); setDialog("edit"); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Edit</button>
                    <button role="menuitem" type="button" onClick={() => { setSelected(teacher); setDialog("status"); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserRoundX size={16} /> {teacher.isActive ? "Deactivate" : "Activate"}</button>
                    <button role="menuitem" type="button" disabled={teacher.hasAccount} onClick={() => { setSelected(teacher); setDialog("account"); setMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"><UserRoundPlus size={16} /> {teacher.hasAccount ? "Account exists" : "Create login account"}</button>
                  </div>}
                </td>
              </tr>)}</tbody>}
          </table></div>
          <DataTablePagination page={params.page} pageSize={params.pageSize} total={response?.meta.total ?? 0} totalPages={response?.meta.totalPages ?? 0}
            onPage={(page) => update({ page }, false)} onPageSize={(pageSize) => update({ page: 1, pageSize }, false)} /></>}
    </section>
    {dialog === "create" && <TeacherFormDialog onClose={close} />}
    {dialog === "edit" && selected && <TeacherFormDialog teacher={selected} onClose={close} />}
    {dialog === "status" && selected && <TeacherStatusDialog teacher={selected} onClose={close} />}
    {dialog === "account" && selected && <CreateAccountDialog personType="teacher" onClose={close} isPending={account.isPending} createAccount={(input) => account.createAccount(selected.id, input)} />}
  </div>;
}

function positive(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
