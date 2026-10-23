"use client";
import { RoleGuard } from "../../../../components/RoleGuard";
import { SectionsList } from "../../../../features/sections/components/SectionsList";
export default function AdminSectionsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><SectionsList /></RoleGuard>;
}
