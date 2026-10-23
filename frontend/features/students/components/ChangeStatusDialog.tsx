"use client";

import { useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { StudentStatus } from "../../../types/student";
import { useUpdateStudentStatus } from "../hooks";
import { Modal } from "./Modal";

const options: { value: StudentStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "DROPPED", label: "Dropped" },
];

export function ChangeStatusDialog({
  studentId,
  currentStatus,
  onClose,
}: Readonly<{ studentId: string; currentStatus: StudentStatus; onClose: () => void }>) {
  const mutation = useUpdateStudentStatus();
  const [status, setStatus] = useState<StudentStatus>(currentStatus);
  const [reason, setReason] = useState("");
  const willDisable = status === "INACTIVE" || status === "DROPPED" || status === "TRANSFERRED";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({
        id: studentId,
        input: { status, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      toast.success("Student status updated");
      onClose();
    } catch {
      toast.error("Could not update student status");
    }
  }

  return (
    <Modal title="Change student status" onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="student-status" className="mb-1.5 block text-sm font-medium text-slate-700">New status</label>
          <select
            id="student-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StudentStatus)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          >
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status-reason" className="mb-1.5 block text-sm font-medium text-slate-700">Reason <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="status-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className={`flex gap-3 rounded-xl p-4 text-sm ${willDisable ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          {willDisable ? <AlertTriangle size={19} className="shrink-0" /> : <span aria-hidden="true">✓</span>}
          {willDisable
            ? "This change will disable the student's login account."
            : "The student's login will be re-enabled if an account exists."}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {mutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
            {mutation.isPending ? "Saving…" : "Update status"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
