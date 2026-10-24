import type { BuiltReport } from "./types.js";

export interface AuditReportRecord {
  createdAt: Date;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  user: { email: string; role: string } | null;
}

export function buildAuditLog(rows: readonly AuditReportRecord[]): BuiltReport {
  return {
    columns: [
      { key: "time", label: "Time" },
      { key: "action", label: "Action" },
      { key: "entity", label: "Entity" },
      { key: "entityId", label: "Entity ID" },
      { key: "actorEmail", label: "Actor Email" },
      { key: "actorRole", label: "Actor Role" },
      { key: "ipAddress", label: "IP Address" },
    ],
    rows: rows.map((row) => ({
      time: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(row.createdAt).replace(",", ""),
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      actorEmail: row.user?.email ?? null,
      actorRole: row.user?.role ?? null,
      ipAddress: row.ipAddress,
    })),
  };
}
