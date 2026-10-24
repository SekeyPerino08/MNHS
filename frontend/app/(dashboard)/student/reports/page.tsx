"use client";

import { RoleGuard } from "../../../../components/RoleGuard";

export default function StudentReportsPage() {
  return <RoleGuard allowedRoles={[]}><div /></RoleGuard>;
}
