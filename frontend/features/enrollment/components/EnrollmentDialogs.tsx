"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "../../../lib/api";
import { Modal, StatusBadge } from "../../../components/shared";
import { useCurrentSchoolYear, useSchoolYears } from "../../school-years/hooks";
import { useSections } from "../../sections/hooks";
import type { Section } from "../../sections/types";
import type { EnrollmentRecord, EnrollmentState } from "../types";
import { useCreateEnrollment, useTransferEnrollment, useUpdateEnrollmentStatus } from "../hooks";

const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm";

function sectionLabel(section: Section) {
  return `Grade ${section.gradeLevel} · ${section.name}`;
}

export function QuickEnrollDialog({ studentId, onClose }: Readonly<{ studentId: string; onClose: () => void }>) {
  const current = useCurrentSchoolYear();
  const schoolYears = useSchoolYears();
  const [schoolYearId, setSchoolYearId] = useState("");
  const selectedSchoolYearId = schoolYearId || current.data?.data.id;
  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState("");
  const sections = useSections({
    page: 1,
    pageSize: 100,
    schoolYearId: selectedSchoolYearId,
  });
  const mutation = useCreateEnrollment();

  async function submit() {
    if (!sectionId) return;
    setError("");
    try {
      await mutation.mutateAsync({ studentId, sectionId });
      toast.success("Student enrolled");
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "ALREADY_ENROLLED") {
        setError(cause.message || "Student is already enrolled for this school year.");
      } else if (cause instanceof ApiError && cause.code === "STUDENT_NOT_ACTIVE") {
        setError("Only active students can be enrolled.");
      } else {
        setError("Could not enroll this student. Please try again.");
      }
    }
  }

  return <Modal title="Enroll in a section" onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">School year
        <select value={selectedSchoolYearId ?? ""} onChange={(event) => { setSchoolYearId(event.target.value); setSectionId(""); }} className={`${selectClass} mt-1`}>
          <option value="">Select school year</option>{schoolYears.data?.data.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (Current)" : ""}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">Section
        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className={`${selectClass} mt-1`}>
          <option value="">Select a section</option>
          {sections.data?.data.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section)}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Cancel</button>
        <button type="button" disabled={!sectionId || mutation.isPending} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Enrolling…" : "Enroll student"}</button>
      </div>
    </div>
  </Modal>;
}

export function TransferEnrollmentDialog({ enrollment, schoolYearId, currentSectionId, sections, onClose }: Readonly<{
  enrollment: EnrollmentRecord;
  schoolYearId: string;
  currentSectionId: string;
  sections: Section[];
  onClose: () => void;
}>) {
  const mutation = useTransferEnrollment();
  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    setError("");
    try {
      await mutation.mutateAsync({ id: enrollment.id, sectionId });
      toast.success("Student transferred");
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "SAME_SECTION") setError("Choose a different section.");
      else if (cause instanceof ApiError && cause.code === "DIFFERENT_SCHOOL_YEAR") setError("Transfers must stay within the same school year.");
      else setError("Could not transfer this student. Please try again.");
    }
  }
  const available = sections.filter((section) => section.id !== currentSectionId && section.schoolYearId === schoolYearId);
  return <Modal title={`Transfer ${enrollment.student.firstName} ${enrollment.student.lastName}`} onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">Target section
        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className={`${selectClass} mt-1`}>
          <option value="">Select a section</option>{available.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section)}</option>)}
        </select>
      </label>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Past attendance and grades stay with the old section’s classes.</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button><button type="button" disabled={!sectionId || mutation.isPending} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Transferring…" : "Transfer"}</button></div>
    </div>
  </Modal>;
}

export function ChangeEnrollmentStatusDialog({ enrollment, onClose }: Readonly<{
  enrollment: EnrollmentRecord;
  onClose: () => void;
}>) {
  const mutation = useUpdateEnrollmentStatus();
  const [status, setStatus] = useState<EnrollmentState>(enrollment.status);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    setError("");
    try {
      await mutation.mutateAsync({ id: enrollment.id, input: { status, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
      toast.success("Enrollment status updated");
      onClose();
    } catch {
      setError("Could not update enrollment status. Please try again.");
    }
  }
  return <Modal title="Change enrollment status" onClose={onClose} disableClose={mutation.isPending} size="max-w-md">
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Update the enrollment status for {enrollment.student.firstName} {enrollment.student.lastName}.</p>
      <label className="block text-sm font-medium text-slate-700">New status<select value={status} onChange={(event) => setStatus(event.target.value as EnrollmentState)} className={`${selectClass} mt-1`}><option value="ENROLLED">Enrolled</option><option value="DROPPED">Dropped</option><option value="COMPLETED">Completed</option></select></label>
      {status === "DROPPED" && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">The student remains in school records and can be re-enrolled later.</p>}
      <ReasonInput reason={reason} setReason={setReason} />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Cancel</button><button type="button" disabled={mutation.isPending} onClick={() => void submit()} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${status === "DROPPED" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>{mutation.isPending ? "Saving…" : "Save status"}</button></div>
    </div>
  </Modal>;
}

function ReasonInput({ reason, setReason }: Readonly<{ reason: string; setReason: (value: string) => void }>) {
  return <label className="block text-sm font-medium text-slate-700">Reason (optional)<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className={`${inputClass} mt-1`} /></label>;
}

export function EnrollmentStatusBadge({ status }: Readonly<{ status: EnrollmentState }>) {
  const colors = { ENROLLED: "green", DROPPED: "red", COMPLETED: "blue" } as const;
  const labels = { ENROLLED: "Enrolled", DROPPED: "Dropped", COMPLETED: "Completed" } as const;
  return <StatusBadge label={labels[status]} color={colors[status]} />;
}
