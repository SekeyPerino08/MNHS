"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { friendlyApiMessage, getFieldErrors, Modal } from "../../../components/shared";
import { useUpdateTerm } from "../hooks";
import { termSchema } from "../schema";
import type { SchoolYear, Term, TermInput } from "../types";

export function TermFormDialog({ year, term, onClose }: Readonly<{ year: SchoolYear; term: Term; onClose: () => void }>) {
  const mutation = useUpdateTerm();
  const form = useForm<TermInput>({ resolver: zodResolver(termSchema), defaultValues: {
    name: term.name, startDate: term.startDate.slice(0, 10), endDate: term.endDate.slice(0, 10),
  } });
  async function submit(input: TermInput) {
    try {
      await mutation.mutateAsync({ schoolYearId: year.id, termId: term.id, input });
      toast.success("Term updated"); onClose();
    } catch (error) {
      const fields = getFieldErrors(error);
      for (const [key, message] of Object.entries(fields)) if (key in form.getValues()) form.setError(key as keyof TermInput, { message });
      const message = friendlyApiMessage(error, "Could not update term");
      if (!Object.keys(fields).length) {
        form.setError("startDate", { message });
        form.setError("endDate", { message });
      }
    }
  }
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500";
  return <Modal title={`Edit ${term.name}`} description={`Dates must stay within ${year.name} and cannot overlap another term.`} onClose={onClose} disableClose={mutation.isPending}>
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div><label htmlFor="term-name" className="mb-1 block text-sm font-medium text-slate-700">Term name</label><input id="term-name" {...form.register("name")} className={inputClass} />{form.formState.errors.name && <Error>{form.formState.errors.name.message}</Error>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="term-start" className="mb-1 block text-sm font-medium text-slate-700">Start date</label><input id="term-start" type="date" {...form.register("startDate")} className={inputClass} />{form.formState.errors.startDate && <Error>{form.formState.errors.startDate.message}</Error>}</div>
        <div><label htmlFor="term-end" className="mb-1 block text-sm font-medium text-slate-700">End date</label><input id="term-end" type="date" {...form.register("endDate")} className={inputClass} />{form.formState.errors.endDate && <Error>{form.formState.errors.endDate.message}</Error>}</div>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={mutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{mutation.isPending && <LoaderCircle size={16} className="animate-spin" />}Save term</button></div>
    </form>
  </Modal>;
}
function Error({ children }: { children?: React.ReactNode }) { return children ? <p role="alert" className="mt-1 text-sm text-rose-700">{children}</p> : null; }
