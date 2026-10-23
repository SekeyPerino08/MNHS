import type { RequestHandler } from "express";
import type { ZodType, ZodTypeDef } from "zod";

export function validateBody<Output, Input>(
  schema: ZodType<Output, ZodTypeDef, Input>,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
