"use client";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { friendlyApiMessage, getFieldErrors, Modal } from "../../../components/shared";
import { useCurrentSchoolYear, useSchoolYears } from "../../school-years/hooks";
import { useTeachers } from "../../teachers/hooks";
import type { TeacherListParams } from "../../teachers/types";
import { useCreateSection, useUpdateSection } from "../hooks";
import { sectionSchema } from "../schema";
import type { Section } from "../types";

export function SectionFormDialog({ section, onClose }: Readonly<{ section?: Section; onClose: () => void }>) {
  const yearsQuery = useSchoolYears(); const currentQuery = useCurrentSchoolYear();
  const teachersParams = useMemo<TeacherListParams>(() => ({ page: 1, pageSize: 100, isActive: true, sortBy: "lastName", order: "asc" }), []);
  const teachersQuery = useTeachers(teachersParams);
  const create = useCreateSection(); const update = useUpdateSection(); const pending = create.isPending || update.isPending;
  const locked = Boolean(section && (section._count?.enrollments ?? 0) > 0);
  const currentYear = currentQuery.data?.data;
  const form = useForm<z.input<typeof sectionSchema>, unknown, z.output<typeof sectionSchema>>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      schoolYearId: section?.schoolYearId ?? currentYear?.id ?? "",
      gradeLevel: section?.gradeLevel ?? 7,
      name: section?.name ?? "",
      adviserId: section?.adviserId ?? "",
    },
  });
  async function submit(input: z.output<typeof sectionSchema>) {
    try {
      if (section) {
        const changes = {
          name: input.name,
          adviserId: input.adviserId || null,
          ...(!locked ? { schoolYearId: input.schoolYearId, gradeLevel: input.gradeLevel } : {}),
        };
        await update.mutateAsync({ id: section.id, input: changes });
      } else {
        await create.mutateAsync({ ...input, schoolYearId: input.schoolYearId || currentYear?.id, adviserId: input.adviserId || null });
      }
      toast.success(section ? "Section updated" : "Section created"); onClose();
    } catch (error) {
      const fields = getFieldErrors(error);
      for (const [field, message] of Object.entries(fields)) if (field in form.getValues()) form.setError(field as keyof z.input<typeof sectionSchema>, { message });
      if (error instanceof ApiError && error.code === "SECTION_EXISTS") form.setError("name", { message: error.message });
      if (error instanceof ApiError && error.code === "ADVISER_ALREADY_ASSIGNED") form.setError("adviserId", { message: error.message });
      if (!(error instanceof ApiError && ["SECTION_EXISTS", "ADVISER_ALREADY_ASSIGNED"].includes(error.code ?? ""))) {
        toast.error(friendlyApiMessage(error, "Could not save section"));
      }
    }
  }
  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500";
  return <Modal title={section ? "Edit section" : "Add section"} onClose={onClose} disableClose={pending}>
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div><label htmlFor="section-year" className="mb-1 block text-sm font-medium text-slate-700">School year</label>
        <select id="section-year" disabled={locked} {...form.register("schoolYearId")} className={inputClass}>
          <option value="">Current school year</option>{yearsQuery.data?.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
        </select>{locked && <p className="mt-1 text-xs text-slate-500">School year is locked because this section has enrolled students.</p>}</div>
      <div><label htmlFor="section-grade" className="mb-1 block text-sm font-medium text-slate-700">Grade level</label>
        <select id="section-grade" disabled={locked} {...form.register("gradeLevel")} className={inputClass}>{[7,8,9,10,11,12].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select>
        {locked && <p className="mt-1 text-xs text-slate-500">Grade level is locked because this section has enrolled students.</p>}</div>
      <div><label htmlFor="section-name" className="mb-1 block text-sm font-medium text-slate-700">Section name</label><input id="section-name" {...form.register("name")} className={inputClass} />{form.formState.errors.name && <Error>{form.formState.errors.name.message}</Error>}</div>
      <div><label htmlFor="section-adviser" className="mb-1 block text-sm font-medium text-slate-700">Adviser</label>
        <select id="section-adviser" {...form.register("adviserId")} className={inputClass}><option value="">No adviser</option>{teachersQuery.data?.data.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.lastName}, {teacher.firstName} · {teacher.employeeNo}</option>)}</select>
        {form.formState.errors.adviserId && <Error>{form.formState.errors.adviserId.message}</Error>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{pending && <LoaderCircle size={16} className="animate-spin" />}{pending ? "Saving…" : "Save section"}</button></div>
    </form>
  </Modal>;
}
function Error({ children }: { children?: React.ReactNode }) { return children ? <p role="alert" className="mt-1 text-sm text-rose-700">{children}</p> : null; }
