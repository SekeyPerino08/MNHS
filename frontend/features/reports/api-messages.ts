import { ApiError } from "../../lib/api";

export function friendlyReportMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "The report request failed.";
  if (error.code === "TERM_NOT_RELEASED" || error.status === 409) {
    return "This quarter has not been released yet, so its grades cannot be exported.";
  }
  if (error.code === "EXPORT_TOO_LARGE" || error.status === 413) {
    return "Too many rows. Narrow the filters and try again.";
  }
  if (error.status === 429) return "You've reached the export limit for this hour. Try again later.";
  if (error.status === 403) return "You don't have access to this report.";
  return error.message;
}
