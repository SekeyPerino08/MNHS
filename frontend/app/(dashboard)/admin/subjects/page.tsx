"use client";
import { RoleGuard } from "../../../../components/RoleGuard";
import { SubjectsList } from "../../../../features/subjects/components/SubjectsList";
export default function AdminSubjectsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><SubjectsList /></RoleGuard>;
}
