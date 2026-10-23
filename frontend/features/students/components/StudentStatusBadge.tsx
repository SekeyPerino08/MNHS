import type { StudentStatus } from "../../../types/student";
import { StatusBadge } from "../../../components/shared";

export function StudentStatusBadge({ status }: Readonly<{ status: StudentStatus }>) {
  const color = ({ ACTIVE: "green", INACTIVE: "gray", GRADUATED: "blue", TRANSFERRED: "yellow", DROPPED: "red" } as const)[status];
  return <StatusBadge label={status.charAt(0) + status.slice(1).toLowerCase()} color={color} />;
}
