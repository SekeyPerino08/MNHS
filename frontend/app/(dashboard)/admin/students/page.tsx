"use client";

import { Suspense } from "react";
import { StudentsList } from "../../../../features/students/components/StudentsList";

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={<StudentsPageSkeleton />}>
      <StudentsList />
    </Suspense>
  );
}

function StudentsPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] animate-pulse space-y-5">
      <div className="h-16 rounded-xl bg-slate-200" />
      <div className="h-16 rounded-xl bg-slate-200" />
      <div className="h-96 rounded-2xl bg-slate-200" />
    </div>
  );
}
