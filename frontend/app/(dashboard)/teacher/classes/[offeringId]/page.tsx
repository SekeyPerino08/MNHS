import { Suspense } from "react";
import { DashboardLayout } from "../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../components/RoleGuard";
import { TeacherClassDetail } from "../../../../../features/class-offerings/components/TeacherClassDetail";

export default function TeacherClassPage({ params }: PageProps<"/teacher/classes/[offeringId]">) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><TeacherClassContent params={params} /></Suspense>;
}

async function TeacherClassContent({ params }: Pick<PageProps<"/teacher/classes/[offeringId]">, "params">) {
  const { offeringId } = await params;
  return <RoleGuard allowedRoles={["TEACHER"]}><DashboardLayout><TeacherClassDetail offeringId={offeringId} /></DashboardLayout></RoleGuard>;
}
