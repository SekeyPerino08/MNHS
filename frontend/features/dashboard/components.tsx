"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Info, RefreshCw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDisplayDate } from "../../lib/dates";
import type { DashboardContext, DashboardTableColumn, DashboardTableRow } from "../../types/dashboard";

const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";

export function SectionHeader({
  eyebrow,
  title,
  description,
  updatedAt,
  onRefresh,
  refreshing = false,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  updatedAt?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}>) {
  const updated = updatedAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(updatedAt)
    : null;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        {updated && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Last updated <time dateTime={updatedAt?.toISOString()}>{updated}</time></p>}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh dashboard"
          aria-live="polite"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw size={16} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      )}
    </header>
  );
}

export function ContextBadge({ context }: Readonly<{ context: DashboardContext | null }>) {
  if (!context) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
        <CalendarDays size={14} aria-hidden="true" /> {context.schoolYear.name}
      </span>
      {context.currentTerm && (
        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {context.currentTerm.name}
        </span>
      )}
      <span className="text-slate-500 dark:text-slate-400">{formatDisplayDate(context.today)}</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  href,
  loading = false,
  unavailable = false,
  warning = false,
  valueClassName = "",
}: Readonly<{
  label: string;
  value: string | number;
  helper?: string;
  icon?: LucideIcon;
  href?: string;
  loading?: boolean;
  unavailable?: boolean;
  warning?: boolean;
  valueClassName?: string;
}>) {
  const content = (
    <div className={`${panelClass} h-full transition ${href ? "hover:border-indigo-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" : ""} ${warning ? "border-amber-300 dark:border-amber-700" : ""}`}>
      {loading ? (
        <div className="animate-pulse space-y-4" aria-label={`Loading ${label}`}>
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            {Icon && <span className={`rounded-xl p-2.5 ${warning ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"}`}><Icon size={19} aria-hidden="true" /></span>}
          </div>
          <p className={`mt-4 text-2xl font-bold text-slate-900 dark:text-white ${valueClassName}`}>
            {unavailable ? <span className="text-base font-semibold text-slate-400">Unavailable</span> : value}
          </p>
          {helper && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
          {href && <ArrowUpRight size={15} aria-hidden="true" className="mt-2 text-slate-400" />}
        </>
      )}
    </div>
  );
  return href && !loading && !unavailable
    ? <Link href={href} className="block rounded-2xl outline-none">{content}</Link>
    : content;
}

export function ChartCard({
  title,
  description,
  children,
  columns,
  rows,
  action,
  rowHref,
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
  action?: ReactNode;
  rowHref?: (row: DashboardTableRow) => string | undefined;
}>) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`${panelClass} min-w-0`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 h-[280px] min-w-0" role="img" aria-label={`${title}. ${rows.map((row) => columns.map((column) => `${column.label}: ${row[column.key] ?? "—"}`).join(", ")).join("; ")}`}>
        {children}
      </div>
      <details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700" open={showTable || undefined} onToggle={(event) => setShowTable((event.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">View as table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <caption className="sr-only">{title} data table</caption>
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-3 py-2 font-semibold">{column.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((row, index) => (
                <tr key={`${String(row[columns[0]?.key] ?? "row")}-${index}`}>
                  {columns.map((column) => {
                    const href = rowHref?.(row);
                    return (
                      <td key={column.key} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {href
                          ? <Link href={href} className="rounded font-medium text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-300">{row[column.key] ?? "—"}</Link>
                          : row[column.key] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">No data available.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function NoSchoolYearState({ admin = false }: Readonly<{ admin?: boolean }>) {
  return (
    <div className={`${panelClass} flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white">No current school year is set</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Dashboard data will appear after a school year is configured as current.</p>
      </div>
      {admin && <Link href="/admin/school-years" className="inline-flex min-h-10 items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Manage school years</Link>}
    </div>
  );
}

export function ProgressPanel({
  title,
  value,
  helper,
  href,
  badge,
  icon: Icon,
}: Readonly<{
  title: string;
  value: number;
  helper: string;
  href?: string;
  badge?: string;
  icon?: LucideIcon;
}>) {
  const content = (
    <div className={`${panelClass} h-full`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        {badge && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{Icon && <Icon size={14} aria-hidden="true" />}{badge}</span>}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}%</p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.max(0, Math.min(100, value))} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
      {href && <span className="mt-2 inline-block text-xs font-semibold text-indigo-700 dark:text-indigo-300">View details</span>}
    </div>
  );
  return href ? <Link href={href} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">{content}</Link> : content;
}

export function AttentionItem({ severity, message, count, href }: Readonly<{
  severity: "warning" | "info";
  message: string;
  count: number;
  href: string;
}>) {
  const Icon = severity === "warning" ? TriangleAlert : Info;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Icon size={18} aria-hidden="true" className={severity === "warning" ? "mt-0.5 shrink-0 text-amber-600" : "mt-0.5 shrink-0 text-blue-600"} />
        <p className="text-sm text-slate-700 dark:text-slate-200">{message} <strong>{count.toLocaleString()}</strong></p>
      </div>
      <Link href={href} className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Review</Link>
    </li>
  );
}

export function AllClear() {
  return <div className="flex items-center gap-2 py-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={18} aria-hidden="true" /> All clear</div>;
}
