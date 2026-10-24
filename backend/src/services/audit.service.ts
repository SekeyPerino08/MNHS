import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { redactSensitive } from "../utils/redact.js";

export interface AuditLogInput {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function logAudit(
  input: AuditLogInput,
  transaction?: Pick<Prisma.TransactionClient, "auditLog">,
): Promise<void> {
  const client = transaction ?? prisma;
  await client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details === undefined
        ? undefined
        : redactSensitive(input.details) as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
    },
  });
}
