// Returns a consistent JSON response for unmatched routes.
import type { Request, Response } from "express";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: "Route not found", code: "NOT_FOUND", requestId: String(req.id) });
}
