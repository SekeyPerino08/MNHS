import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface AuditLogInput {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details,
        ipAddress: input.ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
