"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, FileSpreadsheet, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, DataTablePagination, EmptyState, ErrorState, StatusBadge, TableSkeleton } from "../../../components/shared";
import { useImportHistory, useDiscardImport } from "../hooks";
import type { ImportHistoryItem } from "../../../types/imports";

export function ImportHistory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("historyPage"), 1);
  const pageSize = positiveInt(searchParams.get("historyPageSize"), 10);
  const [now, setNow] = useState(0);
  const history = useImportHistory({ page, pageSize });
  const discard = useDiscardImport();
  const [pendingDiscard, setPendingDiscard] = useState<ImportHistoryItem | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  function setPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("historyPage", String(next));
    router.push(`/admin/imports?${params.toString()}`, { scroll: false });
  }

  function setPageSize(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("historyPage");
    if (next !== 10) params.set("historyPageSize", String(next));
    else params.delete("historyPageSize");
    router.push(params.size ? `/admin/imports?${params.toString()}` : "/admin/imports", { scroll: false });
  }

  async function discardJob() {
    if (!pendingDiscard) return;
    try {
      await discard.mutateAsync(pendingDiscard.id);
      setPendingDiscard(null);
      toast.success("Preview discarded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard this preview.");
    }
  }

  const response = history.data;
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Import history</h2>
        <p className="mt-1 text-sm text-slate-500">Recent CSV previews and imports.</p>
      </div>
      {history.isError ? (
        <ErrorState title="Could not load import history" error={history.error} retry={() => void history.refetch()} />
      ) : !history.isLoading && !response?.data.length ? (
        <EmptyState title="No imports yet" description="Completed and pending imports will appear here." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">File name</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Rejected</th><th className="px-4 py-3">Imported by</th><th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              {history.isLoading && !response ? <TableSkeleton columns={9} rows={5} /> : (
                <tbody className="divide-y divide-slate-100">
                  {response?.data.map((item) => {
                    const expired = item.status === "EXPIRED" || Boolean(item.expiresAt && now > 0 && Date.parse(item.expiresAt) <= now);
                    const canResume = item.status === "PREVIEWED" && !expired;
                    const creator = typeof item.createdBy === "string" ? item.createdBy : item.createdBy?.email;
                    const imported = item.result?.created ?? 0;
                    const rejected = (item.totals?.errors ?? 0) + (item.totals?.warnings ?? 0);
                    return (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                        <td className="px-4 py-3">{item.type === "STUDENTS" ? "Students" : "Teachers"}</td>
                        <td className="max-w-56 truncate px-4 py-3" title={item.fileName}>{item.fileName}</td>
                        <td className="px-4 py-3"><StatusBadge label={expired ? "Expired" : statusLabel(item.status)} color={statusColor(item.status, expired)} /></td>
                        <td className="px-4 py-3">{item.totals?.rows ?? 0}</td>
                        <td className="px-4 py-3">{imported}</td>
                        <td className="px-4 py-3">{rejected}</td>
                        <td className="px-4 py-3">{creator || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {canResume && (
                              <Link href={`/admin/imports?type=${item.type.toLowerCase()}&job=${encodeURIComponent(item.id)}&step=review`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
                                <RotateCcw size={15} aria-hidden="true" /> Resume
                              </Link>
                            )}
                            {item.status === "PREVIEWED" && !expired && (
                              <button type="button" onClick={() => setPendingDiscard(item)} className="inline-flex items-center gap-1 text-sm font-medium text-rose-700 hover:underline">
                                <Trash2 size={15} aria-hidden="true" /> Discard
                              </button>
                            )}
                            {expired && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={14} /> No longer resumable</span>}
                            {item.status === "COMMITTED" && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><FileSpreadsheet size={14} /> Complete</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
          {response && <DataTablePagination page={response.meta.page} pageSize={response.meta.pageSize} total={response.meta.total} totalPages={response.meta.totalPages} onPage={setPage} onPageSize={setPageSize} />}
        </>
      )}
      {pendingDiscard && <ConfirmDialog
        title="Discard this preview?"
        description={`The preview for “${pendingDiscard.fileName}” will be discarded and cannot be resumed.`}
        destructive
        confirmLabel="Discard preview"
        loading={discard.isPending}
        onClose={() => setPendingDiscard(null)}
        onConfirm={() => void discardJob()}
      />}
    </section>
  );
}

function statusLabel(status: ImportHistoryItem["status"]): string {
  return ({ PREVIEWED: "Previewed", COMMITTED: "Imported", DISCARDED: "Discarded", EXPIRED: "Expired" })[status];
}

function statusColor(status: ImportHistoryItem["status"], expired: boolean): "green" | "yellow" | "gray" {
  if (expired || status === "EXPIRED" || status === "DISCARDED") return "gray";
  return status === "COMMITTED" ? "green" : "yellow";
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
