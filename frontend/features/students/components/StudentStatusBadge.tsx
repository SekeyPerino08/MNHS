import type { StudentStatus } from "../../../types/student";

const statusStyles: Record<StudentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-500/15",
  GRADUATED: "bg-blue-50 text-blue-700 ring-blue-600/15",
  TRANSFERRED: "bg-amber-50 text-amber-800 ring-amber-600/20",
  DROPPED: "bg-rose-50 text-rose-700 ring-rose-600/15",
};

export function StudentStatusBadge({ status }: Readonly<{ status: StudentStatus }>) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
