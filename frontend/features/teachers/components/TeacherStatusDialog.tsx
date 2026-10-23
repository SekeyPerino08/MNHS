"use client";

import { useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { friendlyApiMessage, Modal } from "../../../components/shared";
import { useUpdateTeacherStatus } from "../hooks";
import type { Teacher } from "../types";

export function TeacherStatusDialog({ teacher, onClose }: Readonly<{ teacher: Teacher; onClose: () => void }>) {
  const mutation = useUpdateTeacherStatus();
  const [reason, setReason] = useState("");
  const next = !teacher.isActive;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ id: teacher.id, input: { isActive: next, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
      toast.success(next ? "Teacher activated" : "Teacher deactivated");
      onClose();
    } catch (error) { toast.error(friendlyApiMessage(error, "Could not update teacher status")); }
  }
  return <Modal title={next ? "Activate teacher" : "Deactivate teacher"} onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
    <form onSubmit={submit} className="space-y-5">
      <div className={`flex gap-3 rounded-xl p-4 text-sm ${next ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
        {!next && <AlertTriangle size={19} className="shrink-0" />}
        {next ? "The teacher's login will be re-enabled if an account exists." : "Deactivating this teacher will disable their login account."}
      </div>
      <div><label htmlFor="teacher-status-reason" className="mb-1.5 block text-sm font-medium text-slate-700">Reason <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id="teacher-status-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          {mutation.isPending && <LoaderCircle size={16} className="animate-spin" />}{mutation.isPending ? "Saving…" : next ? "Activate" : "Deactivate"}
        </button>
      </div>
    </form>
  </Modal>;
}
