"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAuditFacets, fetchAuditLogs } from "./api";
import type { AuditParams } from "./types";

export function useAuditLogs(params: AuditParams) {
  return useQuery({ queryKey: ["audit-logs", params], queryFn: () => fetchAuditLogs(params), placeholderData: (previous) => previous });
}

export function useAuditFacets() {
  return useQuery({ queryKey: ["audit-log-facets"], queryFn: fetchAuditFacets, staleTime: 60_000 });
}
