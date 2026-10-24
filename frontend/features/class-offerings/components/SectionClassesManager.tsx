"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { ConfirmDialog, Modal } from "../../../components/shared";
import { useSubjects } from "../../subjects/hooks";
import { useTeachers } from "../../teachers/hooks";
import type { TeacherListParams } from "../../teachers/types";
import type { SectionDetail } from "../../sections/types";
import { useBulkCreateClassOfferings, useCreateClassOffering, useDeleteClassOffering, useUpdateClassOffering } from "../hooks";
import type { ClassOfferingRecord } from "../../enrollment/types";

const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
const teacherParams: TeacherListParams = { page: 1, pageSize: 100, isActive: true, sortBy: "lastName", order: "asc" };

export function SectionClassesManager({ section }: Readonly<{ section: SectionDetail }>) {
  const [adding, setAdding] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [teacherEdit, setTeacherEdit] = useState<ClassOfferingRecord | null>(null);
  const [removing, setRemoving] = useState<ClassOfferingRecord | null>(null);
  const [removeError, setRemoveError] = useState("");
  const updateMutation = useUpdateClassOffering();
  const removeMutation = useDeleteClassOffering();
  const offerings: ClassOfferingRecord[] = section.classOfferings.map((offering) => ({
    ...offering,
    section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
    enrolledStudentCount: section.enrollments.length,
  }));

  async function confirmRemove() {
    if (!removing) return;
    setRemoveError("");
    try {
      await removeMutation.mutateAsync(removing.id);
      toast.success("Class offering removed");
      setRemoving(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === "OFFERING_IN_USE") {
        const details = error.details as { attendanceCount?: number; gradeCount?: number } | undefined;
        setRemoveError(`This class has ${details?.attendanceCount ?? 0} attendance records and ${details?.gradeCount ?? 0} grades. Change the teacher instead to preserve these records.`);
      } else setRemoveError("Could not remove this class offering. Please try again.");
    }
  }

  async function saveTeacher(teacherId: string) {
    if (!teacherEdit) return;
    try {
      await updateMutation.mutateAsync({ id: teacherEdit.id, teacherId });
      toast.success("Teacher updated");
      setTeacherEdit(null);
    } catch {
      toast.error("Could not update the teacher. Check that the teacher is active.");
    }
  }

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 className="font-semibold text-slate-900">Classes ({offerings.length})</h2><p className="mt-1 text-sm text-slate-500">Subjects and teachers assigned to this section.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setBulkAdding(true)} className={buttonClass}>Add all subjects for this grade</button><button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={16} /> Add class</button></div>
    </div>
    {offerings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Students</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
      {offerings.map((offering) => <tr key={offering.id}>
        <td className="px-4 py-3"><span className="font-semibold text-slate-900">{offering.subject.code}</span><span className="ml-2 text-slate-600">{offering.subject.name}</span></td>
        <td className="px-4 py-3">{offering.teacher.lastName}, {offering.teacher.firstName}</td>
        <td className="px-4 py-3">{section.enrollments.length}</td>
        <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setTeacherEdit(offering)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"><UserRoundCog size={15} /> Change teacher</button><button type="button" aria-label={`Remove ${offering.subject.name}`} onClick={() => { setRemoving(offering); setRemoveError(""); }} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></button></div></td>
      </tr>)}
    </tbody></table></div> : <p className="px-5 py-8 text-center text-sm text-slate-500">No classes assigned to this section yet.</p>}
    {adding && <AddOfferingDialog section={section} existing={offerings} onClose={() => setAdding(false)} />}
    {bulkAdding && <BulkOfferingsDialog section={section} existing={offerings} onClose={() => setBulkAdding(false)} />}
    {teacherEdit && <ChangeTeacherDialog offering={teacherEdit} onClose={() => setTeacherEdit(null)} onSave={saveTeacher} pending={updateMutation.isPending} />}
    {removing && <ConfirmDialog title="Remove class offering" description={<div><p>Remove {removing.subject.code} · {removing.subject.name} from Grade {section.gradeLevel} · {section.name}?</p>{removeError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{removeError}</p>}</div>} onConfirm={() => void confirmRemove()} onClose={() => setRemoving(null)} destructive loading={removeMutation.isPending} confirmLabel="Remove class" />}
  </section>;
}

function AddOfferingDialog({ section, existing, onClose }: Readonly<{
  section: SectionDetail; existing: ClassOfferingRecord[]; onClose: () => void;
}>) {
  const subjects = useSubjects({ page: 1, pageSize: 100, gradeLevel: section.gradeLevel, sortBy: "name", order: "asc" });
  const teachers = useTeachers(teacherParams);
  const mutation = useCreateClassOffering();
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const offeredIds = new Set(existing.map((item) => item.subjectId));
  const availableSubjects = (subjects.data?.data ?? []).filter((subject) => !offeredIds.has(subject.id));
  async function submit() {
    setError("");
    try {
      await mutation.mutateAsync({ sectionId: section.id, subjectId, teacherId });
      toast.success("Class added");
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "GRADE_LEVEL_MISMATCH") setError("Choose a subject for this section’s grade level.");
      else if (cause instanceof ApiError && cause.code === "TEACHER_NOT_ACTIVE") setError("Choose an active teacher.");
      else if (cause instanceof ApiError && cause.code === "OFFERING_EXISTS") setError("This subject is already offered for this section and school year.");
      else setError("Could not add this class. Please try again.");
    }
  }
  return <Modal title={`Add class · Grade ${section.gradeLevel} ${section.name}`} onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={`${selectClass} mt-1`}><option value="">Select subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.name}</option>)}</select></label>
      <label className="block text-sm font-medium text-slate-700">Teacher<select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={`${selectClass} mt-1`}><option value="">Select active teacher</option>{teachers.data?.data.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.lastName}, {teacher.firstName}{teacher.department ? ` · ${teacher.department}` : ""}</option>)}</select></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!availableSubjects.length && <p className="text-sm text-slate-500">All subjects for this grade are already offered.</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={mutation.isPending} onClick={onClose} className={buttonClass}>Cancel</button><button type="button" disabled={!subjectId || !teacherId || mutation.isPending} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Adding…" : "Add class"}</button></div>
    </div>
  </Modal>;
}

function BulkOfferingsDialog({ section, existing, onClose }: Readonly<{
  section: SectionDetail; existing: ClassOfferingRecord[]; onClose: () => void;
}>) {
  const subjects = useSubjects({ page: 1, pageSize: 100, gradeLevel: section.gradeLevel, sortBy: "name", order: "asc" });
  const teachers = useTeachers(teacherParams);
  const mutation = useBulkCreateClassOfferings();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ created: number; skipped: Array<{ subjectId: string; reason: string }> } | null>(null);
  const offeredIds = new Set(existing.map((item) => item.subjectId));
  const remaining = (subjects.data?.data ?? []).filter((subject) => !offeredIds.has(subject.id));
  const teacherOptions = teachers.data?.data ?? [];
  async function submit() {
    const items = remaining.flatMap((subject) => assignments[subject.id] ? [{ subjectId: subject.id, teacherId: assignments[subject.id] }] : []);
    if (!items.length) return;
    try {
      const response = await mutation.mutateAsync({ sectionId: section.id, items });
      setResult({ created: response.created.length, skipped: response.skipped.map((entry) => ({ subjectId: entry.subjectId, reason: entry.reason })) });
    } catch {
      toast.error("Could not add these classes. Please try again.");
    }
  }
  const selectedCount = Object.values(assignments).filter(Boolean).length;
  const subjectNames = useMemo(() => new Map((subjects.data?.data ?? []).map((subject) => [subject.id, `${subject.code} · ${subject.name}`])), [subjects.data?.data]);
  return <Modal title={`Add all Grade ${section.gradeLevel} subjects`} onClose={onClose} disableClose={mutation.isPending} size="max-w-2xl">
    {result ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Created</p><p className="mt-1 text-2xl font-bold text-emerald-800">{result.created}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-700">Skipped</p><p className="mt-1 text-2xl font-bold text-amber-800">{result.skipped.length}</p></div></div>{result.skipped.map((entry) => <p key={entry.subjectId} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{subjectNames.get(entry.subjectId) ?? "Subject"}: {entry.reason}</p>)}<div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Done</button></div></div>
      : <div className="space-y-4"><p className="text-sm text-slate-600">Choose a teacher for each subject you want to add. Leave a row blank to skip it.</p>{remaining.length ? <div className="max-h-[55vh] space-y-3 overflow-y-auto">{remaining.map((subject) => <label key={subject.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 sm:items-center"><span className="text-sm font-medium text-slate-800">{subject.code} · {subject.name}</span><select aria-label={`Teacher for ${subject.name}`} value={assignments[subject.id] ?? ""} onChange={(event) => setAssignments((before) => ({ ...before, [subject.id]: event.target.value }))} className={selectClass}><option value="">Skip this subject</option>{teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.lastName}, {teacher.firstName}{teacher.department ? ` · ${teacher.department}` : ""}</option>)}</select></label>)}</div> : <p className="py-6 text-center text-sm text-slate-500">No remaining subjects for this grade.</p>}<div className="flex justify-end gap-3"><button type="button" disabled={mutation.isPending} onClick={onClose} className={buttonClass}>Cancel</button><button type="button" disabled={!selectedCount || mutation.isPending} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Adding…" : `Add ${selectedCount} classes`}</button></div></div>}
  </Modal>;
}

function ChangeTeacherDialog({ offering, onClose, onSave, pending }: Readonly<{
  offering: ClassOfferingRecord; onClose: () => void; onSave: (teacherId: string) => void; pending: boolean;
}>) {
  const teachers = useTeachers(teacherParams);
  const [teacherId, setTeacherId] = useState(offering.teacherId);
  return <Modal title="Change class teacher" onClose={onClose} disableClose={pending} size="max-w-md"><div className="space-y-4">
    <div className="rounded-lg bg-slate-50 p-3 text-sm"><p><span className="font-medium">Subject:</span> {offering.subject.code} · {offering.subject.name}</p><p className="mt-1"><span className="font-medium">Section:</span> Grade {offering.section.gradeLevel} · {offering.section.name}</p></div>
    <label className="block text-sm font-medium text-slate-700">Teacher<select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={`${selectClass} mt-1`}>{teachers.data?.data.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.lastName}, {teacher.firstName}{teacher.department ? ` · ${teacher.department}` : ""}</option>)}</select></label>
    <div className="flex justify-end gap-3"><button type="button" disabled={pending} onClick={onClose} className={buttonClass}>Cancel</button><button type="button" disabled={pending || !teacherId} onClick={() => onSave(teacherId)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save teacher"}</button></div>
  </div></Modal>;
}
