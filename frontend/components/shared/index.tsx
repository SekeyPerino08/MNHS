"use client";

import type { ReactNode, FormEvent } from "react";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../lib/api";
import { Modal } from "./Modal";
export { Modal } from "./Modal";

const badgeColors = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
} as const;
export type BadgeColor = keyof typeof badgeColors;

export function StatusBadge({ label, color = "gray" }: Readonly<{ label: string; color?: BadgeColor }>) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeColors[color]}`}>{label}</span>;
}

export function SortableHeader<T extends string>({ label, sortKey, current, order, onSort }: Readonly<{
  label: string; sortKey: T; current: T; order: "asc" | "desc"; onSort: (key: T) => void;
}>) {
  const active = current === sortKey;
  const Icon = active ? (order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 hover:text-slate-900">
      {label}<Icon size={14} aria-hidden="true" />{active && <span className="sr-only">sorted {order}</span>}
    </button>
  </th>;
}

export function DataTablePagination({ page, pageSize, total, totalPages, onPage, onPageSize }: Readonly<{
  page: number; pageSize: number; total: number; totalPages: number; onPage: (page: number) => void; onPageSize: (size: number) => void;
}>) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
    <div className="text-sm text-slate-500">Showing {start}-{end} of {total}</div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">Rows
        <select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={18} /></button>
      <button type="button" aria-label="Next page" disabled={!totalPages || page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={18} /></button>
    </div>
  </footer>;
}

export function TableSkeleton({ columns, rows = 5 }: Readonly<{ columns: number; rows?: number }>) {
  return <tbody className="animate-pulse divide-y divide-slate-100">{Array.from({ length: rows }, (_, row) =>
    <tr key={row}>{Array.from({ length: columns }, (_, column) =>
      <td key={column} className="px-4 py-4"><div className="h-4 rounded bg-slate-200" /></td>)}</tr>)}</tbody>;
}

export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
    <h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function ErrorState({ title = "Could not load data", error, retry }: Readonly<{ title?: string; error?: unknown; retry: () => void }>) {
  return <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
    <div className="font-semibold text-slate-900">{title}</div>
    <p className="mt-1 text-sm text-slate-500">{error instanceof ApiError ? error.message : "Please try again."}</p>
    <button type="button" onClick={retry} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Retry</button>
  </div>;
}

export function ConfirmDialog({ title, description, onConfirm, onClose, destructive = false, loading = false, confirmLabel = "Confirm" }: Readonly<{
  title: string; description: ReactNode; onConfirm: () => void; onClose: () => void; destructive?: boolean; loading?: boolean; confirmLabel?: string;
}>) {
  return <Modal title={title} onClose={onClose} disableClose={loading} size="max-w-md">
    <div className="text-sm leading-6 text-slate-600">{description}</div>
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
      <button type="button" disabled={loading} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
      <button type="button" disabled={loading} onClick={onConfirm} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${destructive ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
        {loading && <LoaderCircle size={16} className="animate-spin" />}{loading ? "Please wait…" : confirmLabel}
      </button>
    </div>
  </Modal>;
}

export function TemporaryPasswordPanel({ password, email, personType, onDismiss }: Readonly<{
  password: string; email: string; personType: "student" | "teacher"; onDismiss: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(password); setCopied(true); toast.success("Temporary password copied"); }
    catch { toast.error("Could not copy the password"); }
  }
  return <div className="space-y-5">
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex gap-3 text-sm font-semibold text-amber-950"><ShieldAlert className="shrink-0" size={19} />
        This password is shown only once. Share it securely and ask the {personType} to change it.</div>
      <div className="mt-4 flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-slate-900">{password}</code>
        <button type="button" onClick={() => void copy()} aria-label="Copy temporary password" className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100">
          {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}
        </button></div>
      <p className="mt-3 text-xs text-slate-600">Login email: {email}</p>
    </div>
    <div className="flex justify-end"><button type="button" onClick={onDismiss} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button></div>
  </div>;
}

export function CreateAccountDialog({ personType, onClose, createAccount, isPending }: Readonly<{
  personType: "student" | "teacher"; onClose: () => void;
  createAccount: (input: { email: string; temporaryPassword?: string }) => Promise<{ temporaryPassword: string }>;
  isPending: boolean;
}>) {
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordOnce, setPasswordOnce] = useState<string | null>(null);
  const [error, setError] = useState("");
  const person = personType === "student" ? "Student" : "Teacher";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const result = await createAccount({ email, ...(temporaryPassword ? { temporaryPassword } : {}) });
      setPasswordOnce(result.temporaryPassword); toast.success(`${person} account created`);
    } catch (cause) {
      setError(friendlyApiMessage(cause, `Could not create the ${personType} account`, {
        ACCOUNT_EXISTS: `This ${personType.toLowerCase()} already has an account.`,
        EMAIL_EXISTS: "This email address is already in use.",
      }));
    }
  }
  function dismiss() { setPasswordOnce(null); setTemporaryPassword(""); onClose(); }
  return <Modal title={passwordOnce ? "Account created" : "Create login account"}
    description={passwordOnce ? "Copy and share the credentials securely." : `Create a ${personType} login account.`}
    onClose={dismiss} disableClose={isPending || passwordOnce !== null} size="max-w-md">
    {passwordOnce ? <TemporaryPasswordPanel password={passwordOnce} email={email.trim().toLowerCase()} personType={personType} onDismiss={dismiss} /> :
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <div><label htmlFor="shared-account-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
          <input id="shared-account-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></div>
        <div><label htmlFor="shared-account-password" className="mb-1.5 block text-sm font-medium text-slate-700">Temporary password <span className="font-normal text-slate-400">(leave blank to generate)</span></label>
          <input id="shared-account-password" type="password" minLength={8} maxLength={128} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={isPending} onClick={dismiss} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {isPending && <LoaderCircle size={16} className="animate-spin" />}{isPending ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>}
  </Modal>;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const payload = error.details;
  if (typeof payload !== "object" || payload === null || !("errors" in payload)) return {};
  const raw = payload.errors;
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) =>
    Array.isArray(value) && typeof value[0] === "string" ? [[key, value[0]]] : [],
  ));
}

export function friendlyApiMessage(error: unknown, fallback: string, messages: Record<string, string> = {}) {
  if (error instanceof ApiError) return messages[error.code ?? ""] ?? error.message ?? fallback;
  return fallback;
}
