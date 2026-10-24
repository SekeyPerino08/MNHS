import { apiFetch, downloadApiFile } from "../../lib/api";
import type {
  ImportCommitOptions,
  ImportDateFormat,
  ImportHistoryPage,
  ImportJob,
  ImportResult,
  ImportRowFilter,
  ImportRowsPage,
  ImportType,
} from "../../types/imports";

export async function previewImport(input: {
  file: File;
  type: ImportType;
  dateFormat: ImportDateFormat;
}): Promise<ImportJob> {
  const body = new FormData();
  body.append("file", input.file);
  body.append("type", input.type);
  body.append("dateFormat", input.dateFormat);
  return apiFetch<ImportJob>("/api/imports/preview", { method: "POST", body });
}

export function fetchImportJob(id: string): Promise<ImportJob> {
  return apiFetch<ImportJob>(`/api/imports/${encodeURIComponent(id)}`);
}

export function fetchImportRows(
  id: string,
  params: { status: ImportRowFilter; page: number; pageSize: number },
): Promise<ImportRowsPage> {
  const query = new URLSearchParams({
    status: params.status,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return apiFetch<ImportRowsPage>(`/api/imports/${encodeURIComponent(id)}/rows?${query}`);
}

export function fetchImportHistory(params: { page: number; pageSize: number }): Promise<ImportHistoryPage> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  return apiFetch<ImportHistoryPage>(`/api/imports?${query}`);
}

export function commitImport(id: string, options: ImportCommitOptions): Promise<ImportResult> {
  return apiFetch<ImportResult>(`/api/imports/${encodeURIComponent(id)}/commit`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export function discardImport(id: string): Promise<void> {
  return apiFetch<void>(`/api/imports/${encodeURIComponent(id)}/discard`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function downloadImportTemplate(type: ImportType): Promise<void> {
  const file = type === "STUDENTS" ? "students" : "teachers";
  return downloadApiFile(`/api/imports/templates/${file}.csv`, `${file}-template.csv`).then(() => undefined);
}

export function downloadRejectedRows(id: string, fileName: string): Promise<void> {
  const fallbackName = `${fileName.replace(/\.csv$/i, "")}-rejected.csv`;
  return downloadApiFile(`/api/imports/${encodeURIComponent(id)}/rejected.csv`, fallbackName).then(() => undefined);
}
