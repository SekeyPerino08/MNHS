import { todayInManila } from "./dates.js";

export function sanitizeFilenameScopePart(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return sanitized || "all";
}

export function buildReportFilename(
  key: string,
  scopeParts: readonly (string | null | undefined)[],
  date = todayInManila(),
  draft = false,
): string {
  const safeKey = sanitizeFilenameScopePart(key);
  const scope = scopeParts.filter((part): part is string => Boolean(part))
    .map(sanitizeFilenameScopePart)
    .join("-")
    .slice(0, 100)
    .replace(/-+$/g, "") || "all";
  return `${safeKey}_${scope}${draft ? "_DRAFT" : ""}_${date}.csv`;
}
