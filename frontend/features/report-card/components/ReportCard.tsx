import { AlertTriangle, BookOpen, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";
import type { ReportCard } from "../../../types/report-card";
import { formatRate } from "../../attendance/config";

const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "School Management System";

function formatDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}

function fullName(student: ReportCard["student"]) {
  return `${student.lastName}, ${student.firstName}${student.middleName ? ` ${student.middleName}` : ""}`;
}

export function ReportCardView({ data }: Readonly<{ data: ReportCard }>) {
  const quarterOrder = [...data.terms].sort((a, b) => a.order - b.order);

  return (
    <div className="report-card-shell">
      {data.isDraft && (
        <>
          <div className="report-card-banner">DRAFT: includes unreleased grades</div>
          <div className="report-card-watermark">DRAFT</div>
        </>
      )}
      <article className="report-card-page mx-auto max-w-[210mm] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl print:shadow-none print:border-0 print:rounded-none">
        <header className="border-b border-slate-200 p-6 print:p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">{schoolName}</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Report Card</h1>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div className="font-semibold text-slate-900">School Year</div>
              <div>{data.schoolYear.name}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 p-6 text-sm text-slate-700 print:p-4 md:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student</div>
            <div className="space-y-2">
              <div><span className="font-semibold text-slate-900">Name:</span> {fullName(data.student)}</div>
              <div><span className="font-semibold text-slate-900">Student No:</span> {data.student.studentNo}</div>
              <div><span className="font-semibold text-slate-900">Grade & Section:</span> Grade {data.section.gradeLevel} · {data.section.name}</div>
              <div><span className="font-semibold text-slate-900">Adviser:</span> {data.adviser ? `${data.adviser.firstName} ${data.adviser.lastName}` : "—"}</div>
            </div>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile</div>
            <div className="space-y-2">
              <div><span className="font-semibold text-slate-900">Sex:</span> {data.student.sex}</div>
              <div><span className="font-semibold text-slate-900">Birth date:</span> {formatDate(data.student.birthDate)}</div>
              <div><span className="font-semibold text-slate-900">Enrollment status:</span> {data.enrollmentStatus}</div>
              <div><span className="font-semibold text-slate-900">Generated:</span> {new Date(data.generatedAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 p-6 print:p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BookOpen size={16} aria-hidden="true" /> Grades
          </div>
          <div className="overflow-x-auto print:overflow-hidden">
            <table className="min-w-[780px] w-full border-collapse text-left text-xs print:text-[11px]">
              <caption className="sr-only">Academic grades by subject and quarter</caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">Subject</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">Teacher</th>
                  {quarterOrder.map((term) => (
                    <th key={term.id} className="border border-slate-200 px-2 py-2 text-center font-semibold">Q{term.order}</th>
                  ))}
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Final</th>
                  <th className="border border-slate-200 px-2 py-2 font-semibold">Descriptor</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((subject) => (
                  <tr key={`${subject.subjectCode}-${subject.subjectName}`}>
                    <td className="border border-slate-200 px-2 py-2 align-top">
                      <div className="font-semibold text-slate-900">{subject.subjectName}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">{subject.subjectCode}</div>
                    </td>
                    <td className="border border-slate-200 px-2 py-2 align-top text-slate-700">{subject.teacherName}</td>
                    {quarterOrder.map((term) => {
                      const entry = subject.quarters.find((quarter) => quarter.termId === term.id);
                      const score = entry?.score ?? null;
                      if (entry && entry.released) {
                        return (
                          <td key={`${subject.subjectCode}-${term.id}`} className="border border-slate-200 px-2 py-2 text-center text-slate-700">
                            {score ?? "—"}
                          </td>
                        );
                      }
                      return (
                        <td key={`${subject.subjectCode}-${term.id}`} className="border border-slate-200 px-2 py-2 text-center text-slate-500">
                          {term.released ? "—" : "Not yet released"}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 px-2 py-2 text-center align-top">
                      {subject.finalGrade === null ? "Pending" : `${subject.finalGrade}`}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 align-top">
                      {subject.descriptor ? (
                        <div className="inline-flex items-center gap-1.5">
                          <StatusText value={subject.passing} />
                          <span>{subject.descriptor}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="border border-slate-200 px-2 py-2 font-semibold text-slate-900" colSpan={quarterOrder.length + 2}>General Average</td>
                  <td className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-900">
                    {data.generalAverage === null ? "Not available yet" : data.generalAverage.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 border-b border-slate-200 p-6 print:p-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound size={16} aria-hidden="true" /> Attendance</div>
            <div className="overflow-x-auto print:overflow-hidden">
              <table className="min-w-[480px] w-full border-collapse text-left text-xs print:text-[11px]">
                <caption className="sr-only">Student attendance summary</caption>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 font-semibold">Quarter</th>
                    <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Present</th>
                    <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Absent</th>
                    <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Late</th>
                    <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Excused</th>
                    <th className="border border-slate-200 px-2 py-2 text-center font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance.terms.map((term) => (
                    <tr key={term.termId}>
                      <td className="border border-slate-200 px-2 py-2 font-medium text-slate-700">{term.order}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">{term.present}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">{term.absent}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">{term.late}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">{term.excused}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-semibold">{formatRate(term.rate)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="border border-slate-200 px-2 py-2 font-semibold text-slate-900">Overall</td>
                    <td className="border border-slate-200 px-2 py-2 text-center">{data.attendance.overall.present}</td>
                    <td className="border border-slate-200 px-2 py-2 text-center">{data.attendance.overall.absent}</td>
                    <td className="border border-slate-200 px-2 py-2 text-center">{data.attendance.overall.late}</td>
                    <td className="border border-slate-200 px-2 py-2 text-center">{data.attendance.overall.excused}</td>
                    <td className="border border-slate-200 px-2 py-2 text-center font-semibold">{formatRate(data.attendance.overall.rate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Excused absences are not counted against the student.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck size={16} aria-hidden="true" /> Summary</div>
            <div className="space-y-3 text-sm text-slate-700">
              <div>{data.summary.subjectsPassed} of {data.summary.subjectCount} subjects passed</div>
              {data.summary.allSubjectsPassed === true && <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} aria-hidden="true" /> Passed all subjects</div>}
              {data.summary.allSubjectsPassed === false && <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><AlertTriangle size={14} aria-hidden="true" /> Some subjects still need attention</div>}
            </div>
          </div>
        </section>

        <section className="p-6 print:p-4">
          <div className="grid gap-5 sm:grid-cols-3">
            <SignatureBlock label="Class Adviser" />
            <SignatureBlock label="Principal" />
            <SignatureBlock label="Parent / Guardian" />
          </div>
        </section>

        <footer className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500 print:p-4">
          Generated on {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(data.generatedAt))}
        </footer>
      </article>
    </div>
  );
}

function SignatureBlock({ label }: Readonly<{ label: string }>) {
  return (
    <div className="space-y-3">
      <div className="h-12 border-b border-slate-300" />
      <div className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}

function StatusText({ value }: Readonly<{ value: boolean | null }>) {
  if (value === null) {
    return <span className="text-slate-500">Pending</span>;
  }
  const Icon = value ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 ${value ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon size={14} aria-hidden="true" />
      {value ? "Passed" : "Below 75"}
    </span>
  );
}
