import { apiFetch } from "../../lib/api";
import type { AuditFacets, AuditParams, AuditResponse } from "./types";

export function fetchAuditLogs(params: AuditParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<AuditResponse>(`/api/audit-logs?${query.toString()}`);
}

export function fetchAuditFacets() {
  return apiFetch<AuditFacets>("/api/audit-logs/facets");
}
