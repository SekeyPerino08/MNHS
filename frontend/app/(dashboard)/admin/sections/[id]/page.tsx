import { Suspense } from "react";
import { DashboardLayout } from "../../../../../components/DashboardLayout";
import { RoleGuard } from "../../../../../components/RoleGuard";
import { SectionDetail } from "../../../../../features/sections/components/SectionDetail";
export default function SectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}><SectionDetailContent params={params} /></Suspense>;
}
async function SectionDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoleGuard allowedRoles={["ADMIN"]}><DashboardLayout><SectionDetail id={id} /></DashboardLayout></RoleGuard>;
}
