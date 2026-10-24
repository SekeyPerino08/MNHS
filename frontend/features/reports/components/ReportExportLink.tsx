"use client";

import Link from "next/link";
import { useAuth } from "../../../providers/AuthProvider";
import type { ReportFilters } from "../../../types/reports";

export function ReportExportLink({ report, filters = {}, locked = [], label, className }: Readonly<{
  report: string;
  filters?: ReportFilters;
  locked?: string[];
  label: string;
  className?: string;
}>) {
  const { user } = useAuth();
  const rolePrefix = user?.role === "TEACHER" ? "/teacher" : "/admin";
  const query = new URLSearchParams({ report });
  for (const [key, value] of Object.entries(filters)) query.set(key, String(value));
  if (locked.length) query.set("lock", locked.join(","));
  return <Link href={`${rolePrefix}/reports?${query.toString()}`} className={className}>{label}</Link>;
}
