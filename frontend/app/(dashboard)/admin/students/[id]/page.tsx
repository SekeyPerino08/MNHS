import { Suspense } from "react";
import { StudentDetailView } from "../../../../../features/students/components/StudentDetailView";
import { RoleGuard } from "../../../../../components/RoleGuard";

export default function StudentDetailPage({
  params,
}: PageProps<"/admin/students/[id]">) {
  return (
    <Suspense fallback={<StudentDetailSkeleton />}>
      <StudentDetailContent params={params} />
    </Suspense>
  );
}

async function StudentDetailContent({
  params,
}: Pick<PageProps<"/admin/students/[id]">, "params">) {
  const { id } = await params;
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <StudentDetailView id={id} />
    </RoleGuard>
  );
}

function StudentDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-5">
      <div className="h-10 w-40 rounded-lg bg-slate-200" />
      <div className="h-24 rounded-2xl bg-slate-200" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="h-64 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
