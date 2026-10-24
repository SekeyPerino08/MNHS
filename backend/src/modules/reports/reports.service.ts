import type { Role } from "@prisma/client";
import { getReportCatalog, exportReport, type ReportUser } from "./export.service.js";

export function getReportsForRole(role: Role) {
  return getReportCatalog(role);
}

export function runReportExport(
  key: string,
  filters: unknown,
  preview: boolean,
  user: ReportUser,
  request: { ip?: string },
  response: {
    status(code: number): { json(body: unknown): unknown };
    setHeader(name: string, value: string): void;
    send(body: string): unknown;
  },
): Promise<void> {
  return exportReport(key, filters, preview, user, request, response);
}
