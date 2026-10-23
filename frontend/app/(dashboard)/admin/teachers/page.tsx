"use client";

import { RoleGuard } from "../../../../components/RoleGuard";
import { TeachersList } from "../../../../features/teachers/components/TeachersList";

export default function AdminTeachersPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><TeachersList /></RoleGuard>;
}
