"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { friendlyApiMessage, Modal } from "../../../components/shared";
import { useCreateSchoolYear, useUpdateSchoolYear } from "../hooks";
import { schoolYearSchema } from "../schema";
import type { SchoolYear, SchoolYearInput } from "../types";

export function SchoolYearFormDialog({ year, onClose }: Readonly<{ year?: SchoolYear; onClose: () => void }>) {
  const create = useCreateSchoolYear(); const update = useUpdateSchoolYear(); const pending = create.isPending || update.isPending;
  const form = useForm<SchoolYearInput>({
    resolver: zodResolver(schoolYearSchema),
    defaultValues: {
      name: year?.name ?? "",
      startDate: year?.startDate.slice(0, 10) ?? "",
      endDate: year?.endDate.slice(0, 10) ?? "",
    },
  });
  async function submit(input: SchoolYearInput) {
    try {
      if (year) await update.mutateAsync({ id: year.id, input });
      else await create.mutateAsync(input);
      toast.success(year ? "School year updated" : "School year created"); onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SCHOOL_YEAR_EXISTS") form.setError("name", { message: error.message });
      else toast.error(friendlyApiMessage(error, "Could not save school year"));
    }
  }
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500";
  return <Modal title={year ? "Edit school year" : "Add school year"} onClose={onClose} disableClose={pending}>
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div><label htmlFor="school-year-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label><input id="school-year-name" placeholder="2026-2027" {...form.register("name")} className={inputClass} /><p className="mt-1 text-xs text-slate-500">Use YYYY-YYYY; the second year must be the first year plus one.</p>{form.formState.errors.name && <Error>{form.formState.errors.name.message}</Error>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="school-year-start" className="mb-1 block text-sm font-medium text-slate-700">Start date</label><input id="school-year-start" type="date" {...form.register("startDate")} className={inputClass} />{form.formState.errors.startDate && <Error>{form.formState.errors.startDate.message}</Error>}</div>
        <div><label htmlFor="school-year-end" className="mb-1 block text-sm font-medium text-slate-700">End date</label><input id="school-year-end" type="date" {...form.register("endDate")} className={inputClass} />{form.formState.errors.endDate && <Error>{form.formState.errors.endDate.message}</Error>}</div>
      </div>
      {!year && <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">Four quarters will be created automatically by splitting this date range evenly. You can edit the quarter dates afterward.</p>}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{pending && <LoaderCircle size={16} className="animate-spin" />}{pending ? "Saving…" : year ? "Save changes" : "Add school year"}</button></div>
    </form>
  </Modal>;
}
export function Error({ children }: { children?: React.ReactNode }) { return children ? <p role="alert" className="mt-1 text-sm text-rose-700">{children}</p> : null; }
