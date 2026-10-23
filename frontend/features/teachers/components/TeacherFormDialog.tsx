"use client";

import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { getFieldErrors, friendlyApiMessage, Modal } from "../../../components/shared";
import { useCreateTeacher, useUpdateTeacher } from "../hooks";
import { teacherFormSchema, type TeacherFormValues, type TeacherParsedValues } from "../schema";
import type { Teacher } from "../types";

export function TeacherFormDialog({ teacher, onClose }: Readonly<{ teacher?: Teacher; onClose: () => void }>) {
  const create = useCreateTeacher();
  const update = useUpdateTeacher();
  const pending = create.isPending || update.isPending;
  const form = useForm<TeacherFormValues, unknown, TeacherParsedValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      employeeNo: teacher?.employeeNo ?? "",
      firstName: teacher?.firstName ?? "",
      middleName: teacher?.middleName ?? "",
      lastName: teacher?.lastName ?? "",
      department: teacher?.department ?? "",
      contactNo: teacher?.contactNo ?? "",
    },
  });
  const serverErrors = form.formState.errors;

  async function submit(values: TeacherParsedValues) {
    try {
      const optionalFields = {
        middleName: values.middleName ?? null,
        department: values.department ?? "",
        contactNo: values.contactNo ?? "",
      };
      if (teacher) {
        const editable = {
          firstName: values.firstName,
          middleName: optionalFields.middleName,
          lastName: values.lastName,
          department: optionalFields.department,
          contactNo: optionalFields.contactNo,
        };
        await update.mutateAsync({ id: teacher.id, input: editable });
        toast.success("Teacher updated");
      } else {
        await create.mutateAsync({ ...values, ...optionalFields });
        toast.success("Teacher created");
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMPLOYEE_NO_EXISTS") {
        form.setError("employeeNo", { message: error.message });
      } else {
        for (const [field, message] of Object.entries(getFieldErrors(error))) {
          if (field in form.getValues()) form.setError(field as keyof TeacherFormValues, { message });
        }
        toast.error(friendlyApiMessage(error, "Could not save teacher"));
      }
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500";
  return <Modal title={teacher ? "Edit teacher" : "Add teacher"} onClose={onClose} disableClose={pending}>
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Teacher information</legend>
        <div><label htmlFor="teacher-employeeNo" className="mb-1 block text-sm font-medium text-slate-700">Employee No</label>
          <input id="teacher-employeeNo" readOnly={Boolean(teacher)} {...form.register("employeeNo")} className={`${inputClass} ${teacher ? "bg-slate-50 text-slate-500" : ""}`} />
          {serverErrors.employeeNo && <p role="alert" className="mt-1 text-sm text-rose-700">{serverErrors.employeeNo.message}</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="teacher-firstName" label="First name" error={serverErrors.firstName?.message} register={form.register("firstName")} className={inputClass} />
          <Field id="teacher-middleName" label="Middle name (optional)" error={serverErrors.middleName?.message} register={form.register("middleName")} className={inputClass} />
          <Field id="teacher-lastName" label="Last name" error={serverErrors.lastName?.message} register={form.register("lastName")} className={inputClass} />
          <Field id="teacher-department" label="Department (optional)" error={serverErrors.department?.message} register={form.register("department")} className={inputClass} />
          <Field id="teacher-contactNo" label="Contact number (optional)" error={serverErrors.contactNo?.message} register={form.register("contactNo")} className={inputClass} />
        </div>
      </fieldset>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending && <LoaderCircle size={16} className="animate-spin" />}{pending ? "Saving…" : teacher ? "Save changes" : "Add teacher"}
        </button>
      </div>
    </form>
  </Modal>;
}

function Field({ id, label, error, register, className }: { id: string; label: string; error?: string; register: UseFormRegisterReturn; className: string }) {
  return <div><label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
    <input id={id} {...register} className={className} />
    {error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}</div>;
}
