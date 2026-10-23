"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { friendlyApiMessage, getFieldErrors, Modal } from "../../../components/shared";
import { useCreateSubject, useUpdateSubject } from "../hooks";
import { subjectSchema, type SubjectFormValues } from "../schema";
import type { z } from "zod";
import type { Subject } from "../types";

export function SubjectFormDialog({ subject, onClose }: Readonly<{ subject?: Subject; onClose: () => void }>) {
  const create = useCreateSubject(); const update = useUpdateSubject(); const pending = create.isPending || update.isPending;
  const form = useForm<SubjectFormValues, unknown, z.output<typeof subjectSchema>>({ resolver: zodResolver(subjectSchema), defaultValues: {
    code: subject?.code ?? "", name: subject?.name ?? "", description: subject?.description ?? "", gradeLevel: subject?.gradeLevel ?? 7,
  } });
  async function submit(input: z.output<typeof subjectSchema>) {
    try {
      const data = { ...input, description: input.description ?? "", gradeLevel: Number(input.gradeLevel) };
      if (subject) await update.mutateAsync({ id: subject.id, input: data });
      else await create.mutateAsync(data);
      toast.success(subject ? "Subject updated" : "Subject created"); onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SUBJECT_CODE_EXISTS") form.setError("code", { message: error.message });
      else {
        for (const [field, message] of Object.entries(getFieldErrors(error))) if (field in form.getValues()) form.setError(field as keyof SubjectFormValues, { message });
        toast.error(friendlyApiMessage(error, "Could not save subject"));
      }
    }
  }
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500";
  return <Modal title={subject ? "Edit subject" : "Add subject"} onClose={onClose} disableClose={pending}>
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div><label htmlFor="subject-code" className="mb-1 block text-sm font-medium text-slate-700">Code</label><input id="subject-code" {...form.register("code")} onChange={(event) => form.setValue("code", event.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })} className={input} />{form.formState.errors.code && <p role="alert" className="mt-1 text-sm text-rose-700">{form.formState.errors.code.message}</p>}</div>
      <div><label htmlFor="subject-name" className="mb-1 block text-sm font-medium text-slate-700">Name</label><input id="subject-name" {...form.register("name")} className={input} />{form.formState.errors.name && <p role="alert" className="mt-1 text-sm text-rose-700">{form.formState.errors.name.message}</p>}</div>
      <div><label htmlFor="subject-grade" className="mb-1 block text-sm font-medium text-slate-700">Grade level</label><select id="subject-grade" {...form.register("gradeLevel")} className={input}>{[7,8,9,10,11,12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></div>
      <div><label htmlFor="subject-description" className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label><textarea id="subject-description" rows={3} {...form.register("description")} className={input} /></div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{pending && <LoaderCircle size={16} className="animate-spin" />}{pending ? "Saving…" : "Save subject"}</button></div>
    </form>
  </Modal>;
}
