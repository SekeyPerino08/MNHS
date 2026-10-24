import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

const dateFilter = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a valid YYYY-MM-DD date");

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  actorId: idSchema.optional(),
  q: z.string().trim().optional(),
  from: dateFilter.optional(),
  to: dateFilter.optional(),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: "from must be on or before to",
  path: ["from"],
});
