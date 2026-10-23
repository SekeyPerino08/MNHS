"use client";

import { useEffect, useState } from "react";
import { cloneElement, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { friendlyApiMessage, getFieldErrors } from "../../../components/shared";
import type { Student, StudentInput } from "../../../types/student";
import { useCreateStudent, useUpdateStudent } from "../hooks";
import { studentFormSchema, type StudentFormValues } from "../student.schema";
import { Modal } from "../../../components/shared/Modal";

interface DuplicateStudent {
  id: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: string | null;
  status: string;
}

type FormField = keyof StudentFormValues;

export function StudentFormDialog({
  student,
  onClose,
}: Readonly<{ student?: Student; onClose: () => void }>) {
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const [duplicates, setDuplicates] = useState<DuplicateStudent[]>([]);
  const isEditing = Boolean(student);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      studentNo: student?.studentNo ?? "",
      firstName: student?.firstName ?? "",
      middleName: student?.middleName ?? "",
      lastName: student?.lastName ?? "",
      sex: student?.sex ?? "FEMALE",
      birthDate: student?.birthDate?.slice(0, 10) ?? "",
      address: student?.address ?? "",
      guardianName: student?.guardianName ?? "",
      guardianContact: student?.guardianContact ?? "",
    },
  });

  useEffect(() => {
    if (!isSubmitting) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSubmitting]);

  async function submit(values: StudentFormValues, confirmDuplicate = false) {
    const input: StudentInput = {
      studentNo: values.studentNo.trim(),
      firstName: values.firstName,
      middleName: values.middleName?.trim() || null,
      lastName: values.lastName,
      sex: values.sex,
      birthDate: values.birthDate,
      address: values.address?.trim() || null,
      guardianName: values.guardianName?.trim() || null,
      guardianContact: values.guardianContact?.trim() || null,
      ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
    };
    try {
      if (student) {
        const editable = Object.fromEntries(
          Object.entries(input).filter(([key]) => key !== "studentNo" && key !== "confirmDuplicate"),
        ) as Partial<Omit<StudentInput, "studentNo" | "confirmDuplicate">>;
        await updateMutation.mutateAsync({ id: student.id, input: editable });
        toast.success("Student updated");
      } else {
        const createInput = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== null),
        ) as StudentInput;
        await createMutation.mutateAsync(createInput);
        toast.success("Student created");
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        if (!confirmDuplicate && error.code === "POSSIBLE_DUPLICATE") {
          const payload = error.details as { matches?: DuplicateStudent[] } | undefined;
          setDuplicates(payload?.matches ?? []);
          return;
        }
        if (error.code === "STUDENT_NO_EXISTS") {
          setError("studentNo", { message: error.message });
          return;
        }
        const fields = getFieldErrors(error);
        if (error.status === 400 && Object.keys(fields).length) {
          for (const [field, message] of Object.entries(fields)) {
            if (["studentNo", "firstName", "middleName", "lastName", "sex", "birthDate", "address", "guardianName", "guardianContact"].includes(field)) {
              setError(field as FormField, { message });
            }
          }
          return;
        }
        toast.error(friendlyApiMessage(error, "Could not save the student"));
      } else {
        toast.error(friendlyApiMessage(error, "Could not save the student"));
      }
    }
  }

  const onSubmit = handleSubmit((values) => submit(values));

  return (
    <>
      <Modal
        title={student ? "Edit student" : "Add student"}
        description="Enter the student's details below."
        onClose={onClose}
        disableClose={isSubmitting}
        size="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset disabled={isSubmitting} className="space-y-6">
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Student information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Student number" error={errors.studentNo?.message}>
                  <input {...register("studentNo")} readOnly={isEditing} className={fieldClass(isEditing)} autoComplete="off" />
                </Field>
                <Field label="Sex" error={errors.sex?.message}>
                  <select {...register("sex")} className={fieldClass()}>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                  </select>
                </Field>
                <Field label="First name" error={errors.firstName?.message}>
                  <input {...register("firstName")} className={fieldClass()} autoComplete="given-name" />
                </Field>
                <Field label="Middle name" error={errors.middleName?.message}>
                  <input {...register("middleName")} className={fieldClass()} autoComplete="additional-name" />
                </Field>
                <Field label="Last name" error={errors.lastName?.message}>
                  <input {...register("lastName")} className={fieldClass()} autoComplete="family-name" />
                </Field>
                <Field label="Birth date" error={errors.birthDate?.message}>
                  <input type="date" {...register("birthDate")} className={fieldClass()} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address" error={errors.address?.message}>
                    <input {...register("address")} className={fieldClass()} autoComplete="street-address" />
                  </Field>
                </div>
              </div>
            </section>
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Guardian information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Guardian name" error={errors.guardianName?.message}>
                  <input {...register("guardianName")} className={fieldClass()} />
                </Field>
                <Field label="Guardian contact" error={errors.guardianContact?.message}>
                  <input {...register("guardianContact")} className={fieldClass()} autoComplete="tel" />
                </Field>
              </div>
            </section>
          </fieldset>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" disabled={isSubmitting} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}
              {isSubmitting ? "Saving…" : student ? "Save changes" : "Create student"}
            </button>
          </div>
        </form>
      </Modal>

      {duplicates.length > 0 && (
        <Modal
          title="Possible duplicate students"
          description="Review these matching records before continuing."
          onClose={() => setDuplicates([])}
          disableClose={isSubmitting}
          size="max-w-lg"
        >
          <div className="mb-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={19} className="shrink-0" />
            Similar student records were found. Create another record only if you have confirmed it is a different student.
          </div>
          <ul className="mb-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {duplicates.map((match) => (
              <li key={match.id} className="p-3 text-sm">
                <div className="font-semibold text-slate-900">{match.lastName}, {match.firstName} {match.middleName ?? ""}</div>
                <div className="mt-1 text-slate-500">
                  {match.studentNo} · {match.birthDate ? formatDate(match.birthDate) : "No birth date"} · {match.status}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDuplicates([])} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Cancel
            </button>
            <button type="button" disabled={isSubmitting} onClick={() => void handleSubmit((values) => submit(values, true))()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isSubmitting ? "Creating…" : "Create anyway"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({
  label,
  error,
  children,
}: Readonly<{ label: string; error?: string; children: ReactElement<{ id?: string }> }>) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="[&_input]:w-full [&_select]:w-full [&_input]:rounded-lg [&_select]:rounded-lg [&_input]:border [&_select]:border [&_input]:border-slate-300 [&_select]:border-slate-300 [&_input]:px-3 [&_select]:px-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_input]:text-sm [&_select]:text-sm [&_input]:outline-none [&_select]:outline-none [&_input]:focus:border-indigo-500 [&_select]:focus:border-indigo-500">
        {cloneElement(children, { id })}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function fieldClass(readOnly = false): string {
  return readOnly ? "bg-slate-100 text-slate-500" : "bg-white text-slate-900";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
