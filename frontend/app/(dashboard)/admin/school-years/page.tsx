"use client";
import { RoleGuard } from "../../../../components/RoleGuard";
import { SchoolYearsList } from "../../../../features/school-years/components/SchoolYearsList";
export default function AdminSchoolYearsPage() {
  return <RoleGuard allowedRoles={["ADMIN"]}><SchoolYearsList /></RoleGuard>;
}
