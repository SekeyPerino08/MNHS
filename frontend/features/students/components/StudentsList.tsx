"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Ellipsis,
  Eye,
  Pencil,
  Search,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
import { RoleGuard } from "../../../components/RoleGuard";
import { ApiError } from "../../../lib/api";
import { useStudents } from "../hooks";
import type { Student, StudentListParams, StudentStatus } from "../../../types/student";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { StudentFormDialog } from "./StudentFormDialog";
import { StudentStatusBadge } from "./StudentStatusBadge";

type SortBy = StudentListParams["sortBy"];
const statusOptions: { value: StudentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "DROPPED", label: "Dropped" },
];

export function StudentsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<"create" | "edit" | "status" | "account" | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);

  const params = useMemo<StudentListParams>(() => ({
    page: numberParam(searchParams.get("page"), 1),
    pageSize: numberParam(searchParams.get("pageSize"), 10),
    search: searchParams.get("search") || undefined,
    status: isStudentStatus(searchParams.get("status")) ? searchParams.get("status") as StudentStatus : undefined,
    gradeLevel: searchParams.get("gradeLevel") ? numberParam(searchParams.get("gradeLevel"), 7) : undefined,
    sortBy: isSortBy(searchParams.get("sortBy")) ? searchParams.get("sortBy") as SortBy : "lastName",
    order: searchParams.get("order") === "desc" ? "desc" : "asc",
  }), [searchParams]);

  const updateQuery = useCallback((updates: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    if (resetPage && !("page" in updates)) next.set("page", "1");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, []);

  const query = useStudents(params);
  const response = query.data;
  const total = response?.meta.total ?? 0;
  const page = params.page;
  const pageSize = params.pageSize;
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const activeFilters = Boolean(params.search || params.status || params.gradeLevel);

  function clearFilters() {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    router.push(pathname, { scroll: false });
  }

  function setStudentDialog(kind: "edit" | "status" | "account", student: Student) {
    setSelected(student);
    setDialog(kind);
    setOpenMenu(null);
  }

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Administration</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Students</h1>
            <p className="mt-1 text-sm text-slate-500">Manage student records, enrollment, and login access.</p>
          </div>
          <button type="button" onClick={() => { setSelected(null); setDialog("create"); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <CirclePlus size={18} aria-hidden="true" /> Add student
          </button>
        </header>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_200px_180px_auto]">
            <label className="relative block">
              <span className="sr-only">Search students</span>
              <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input key={searchParams.get("search") ?? ""} defaultValue={searchParams.get("search") ?? ""} onChange={(event) => {
                const value = event.target.value;
                if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => {
                  updateQuery({ search: value.trim() || null });
                  searchTimer.current = null;
                }, 400);
              }} placeholder="Search name or student number" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={params.status ?? ""} onChange={(event) => updateQuery({ status: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by grade level</span>
              <select value={params.gradeLevel ?? ""} onChange={(event) => updateQuery({ gradeLevel: event.target.value || null })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
                <option value="">All grades</option>
                {[7, 8, 9, 10, 11, 12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!activeFilters} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Clear filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {query.isError ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="font-semibold text-slate-900">Could not load students</div>
              <p className="mt-1 text-sm text-slate-500">{query.error instanceof ApiError ? query.error.message : "Please try again."}</p>
              <button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Retry</button>
            </div>
          ) : !query.isLoading && !response?.data.length ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500"><Search size={22} /></div>
              <h2 className="font-semibold text-slate-900">No students match your filters</h2>
              <p className="mt-1 text-sm text-slate-500">Try changing the search or filter options.</p>
              {activeFilters && <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Clear filters</button>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <SortHeader label="Student No" sortKey="studentNo" current={params.sortBy} order={params.order} onSort={sort} />
                      <SortHeader label="Name" sortKey="lastName" current={params.sortBy} order={params.order} onSort={sort} />
                      <th scope="col" className="px-4 py-3 font-semibold">Sex</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Grade &amp; Section</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Guardian contact</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <SortHeader label="Created date" sortKey="createdAt" current={params.sortBy} order={params.order} onSort={sort} />
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {query.isLoading && !response
                      ? Array.from({ length: pageSize }, (_, index) => <SkeletonRow key={index} />)
                      : response?.data.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">{item.studentNo}</td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <Link href={`/admin/students/${item.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                              {item.lastName}, {item.firstName}{item.middleName ? ` ${item.middleName.charAt(0)}.` : ""}
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{item.sex === "MALE" ? "Male" : "Female"}</td>
                          <td className="px-4 py-4 text-slate-600">
                            {item.currentEnrollment?.section
                              ? `Grade ${item.currentEnrollment.section.gradeLevel} · ${item.currentEnrollment.section.name}`
                              : "Not enrolled"}
                          </td>
                          <td className="px-4 py-4 text-slate-600">{item.guardianContact || "—"}</td>
                          <td className="px-4 py-4"><StudentStatusBadge status={item.status} /></td>
                          <td className="whitespace-nowrap px-4 py-4 text-slate-500">{formatDate(item.createdAt)}</td>
                          <td className="relative px-4 py-3 text-right">
                            <button type="button" aria-label={`Actions for ${item.firstName} ${item.lastName}`} aria-expanded={openMenu === item.id} onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                              <Ellipsis size={19} />
                            </button>
                            {openMenu === item.id && (
                              <div role="menu" className="absolute right-8 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg">
                                <Link role="menuitem" href={`/admin/students/${item.id}`} onClick={() => setOpenMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Eye size={16} /> View</Link>
                                <button role="menuitem" type="button" onClick={() => setStudentDialog("edit", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Edit</button>
                                <button role="menuitem" type="button" onClick={() => setStudentDialog("status", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserRoundX size={16} /> Change status</button>
                                <button role="menuitem" type="button" disabled={Boolean(item.userId)} onClick={() => setStudentDialog("account", item)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><UserRoundPlus size={16} /> {item.userId ? "Account exists" : "Create login account"}</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                <div className="text-sm text-slate-500">Showing {start}-{end} of {total}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Rows
                    <select value={pageSize} onChange={(event) => updateQuery({ pageSize: event.target.value, page: "1" }, false)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
                      {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <span className="text-sm text-slate-500">Page {page} of {response?.meta.totalPages ?? 0}</span>
                  <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => updateQuery({ page: String(page - 1) }, false)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={18} /></button>
                  <button type="button" aria-label="Next page" disabled={page >= (response?.meta.totalPages ?? 0)} onClick={() => updateQuery({ page: String(page + 1) }, false)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={18} /></button>
                </div>
              </footer>
            </>
          )}
        </section>

        {dialog === "create" && <StudentFormDialog onClose={() => setDialog(null)} />}
        {dialog === "edit" && selected && <StudentFormDialog student={selected} onClose={() => setDialog(null)} />}
        {dialog === "status" && selected && <ChangeStatusDialog studentId={selected.id} currentStatus={selected.status} onClose={() => setDialog(null)} />}
        {dialog === "account" && selected && <CreateAccountDialog studentId={selected.id} onClose={() => setDialog(null)} />}
      </div>
    </RoleGuard>
  );

  function sort(key: SortBy) {
    const nextOrder = params.sortBy === key && params.order === "asc" ? "desc" : "asc";
    updateQuery({ sortBy: key, order: nextOrder }, false);
  }
}

function SortHeader({
  label,
  sortKey,
  current,
  order,
  onSort,
}: Readonly<{
  label: string;
  sortKey: SortBy;
  current: SortBy;
  order: "asc" | "desc";
  onSort: (key: SortBy) => void;
}>) {
  const active = current === sortKey;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className="px-4 py-3 font-semibold">
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 hover:text-slate-900" aria-label={`Sort by ${label}${active ? ` ${order}ending` : ""}`}>
        {label}<Icon size={14} aria-hidden="true" className={active ? "text-indigo-600" : "text-slate-400"} />
      </button>
    </th>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true" className="animate-pulse">
      {Array.from({ length: 8 }, (_, index) => <td key={index} className="px-4 py-5"><div className="h-4 rounded bg-slate-200" /></td>)}
    </tr>
  );
}

function numberParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isStudentStatus(value: string | null): value is StudentStatus {
  return ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "DROPPED"].includes(value ?? "");
}

function isSortBy(value: string | null): value is SortBy {
  return ["lastName", "firstName", "studentNo", "createdAt"].includes(value ?? "");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
