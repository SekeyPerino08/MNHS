"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReportCatalog, fetchReportPreview } from "./api";
import type { ReportFilters } from "../../types/reports";

export const reportKeys = {
  all: ["reports"] as const,
  catalog: () => [...reportKeys.all, "catalog"] as const,
  preview: (key: string, filters: ReportFilters) => [...reportKeys.all, "preview", key, filters] as const,
};

export function useReportCatalog() {
  return useQuery({
    queryKey: reportKeys.catalog(),
    queryFn: fetchReportCatalog,
    staleTime: 60_000,
  });
}

export function useReportPreview(key: string, filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: reportKeys.preview(key, filters),
    queryFn: () => fetchReportPreview(key, filters),
    enabled: Boolean(key) && enabled,
    retry: false,
    gcTime: 0,
  });
}
