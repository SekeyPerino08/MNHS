import type { Role } from "../../types/auth";

export interface AuditActor {
  id: string;
  email: string;
  role: Role;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  actor: AuditActor | null;
  details: unknown;
}

export interface AuditResponse {
  data: AuditEntry[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AuditParams {
  page: number;
  pageSize: number;
  action?: string;
  entity?: string;
  actorId?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface AuditFacets {
  actions: string[];
  entities: string[];
}
