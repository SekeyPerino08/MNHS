import type { RequestHandler } from "express";
import type { ZodType, ZodTypeDef } from "zod";

export function validateBody<Output, Input>(
  schema: ZodType<Output, ZodTypeDef, Input>,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
