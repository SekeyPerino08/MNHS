import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { redactSensitive } from "../../utils/redact.js";
import { listAuditLogsQuerySchema } from "./audit-log.schema.js";

function manilaStartOfDay(date: string): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - 8 * 60 * 60 * 1000);
}

function manilaStartOfNextDay(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000);
}

export async function listAuditLogs(input: unknown) {
  const parsed = listAuditLogsQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.actorId ? { userId: query.actorId } : {}),
    ...(query.q ? { user: { is: { email: { contains: query.q, mode: "insensitive" } } } } : {}),
    ...((query.from || query.to) ? {
      createdAt: {
        ...(query.from ? { gte: manilaStartOfDay(query.from) } : {}),
        ...(query.to ? { lt: manilaStartOfNextDay(query.to) } : {}),
      },
    } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        ipAddress: true,
        details: true,
        user: { select: { id: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    data: rows.map(({ user, details, ...row }) => ({
      ...row,
      details: details === null ? null : redactSensitive(details),
      actor: user,
    })),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getAuditLogFacets() {
  const [actions, entities] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  return { actions: actions.map(({ action }) => action), entities: entities.map(({ entity }) => entity) };
}

export async function getAuditLog(id: string) {
  const row = await prisma.auditLog.findUnique({
    where: { id },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      createdAt: true,
      ipAddress: true,
      details: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });
  if (!row) throw new AppError("Audit log entry not found", 404);
  const { user, details, ...rest } = row;
  return { ...rest, details: details === null ? null : redactSensitive(details), actor: user };
}

// Audit logs are append-only: this module intentionally exposes no update or delete operations.
