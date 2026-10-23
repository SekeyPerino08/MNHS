import { Suspense } from "react";
import { RoleGuard } from "../../../../../components/RoleGuard";
import { TeacherDetail } from "../../../../../features/teachers/components/TeacherDetail";

export default function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><TeacherDetailContent params={params} /></Suspense>;
}
async function TeacherDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoleGuard allowedRoles={["ADMIN"]}><TeacherDetail id={id} /></RoleGuard>;
}
