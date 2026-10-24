export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let redirectingForPasswordChange = false;

interface ApiOptions extends Omit<RequestInit, "credentials"> {
  credentials?: RequestCredentials;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  let payload: unknown;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const serverMessage =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : response.statusText || "Request failed";
    const code =
      typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : undefined;
    if (
      response.status === 403 &&
      code === "PASSWORD_CHANGE_REQUIRED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password" &&
      !redirectingForPasswordChange
    ) {
      redirectingForPasswordChange = true;
      window.location.replace("/change-password");
    }
    throw new ApiError(response.status, friendlyApiMessage(code, serverMessage, payload), code, payload);
  }

  return payload as T;
}

export function friendlyApiMessage(code: string | undefined, fallback: string, payload?: unknown): string {
  switch (code) {
    case "INVALID_ENCODING": return "Save the file as CSV UTF-8 and try again.";
    case "MISSING_COLUMNS": {
      const missing = findStringArray(payload, "missing");
      return missing.length
        ? `Required columns are missing: ${missing.join(", ")}.`
        : "Required columns are missing. Download the template to check the column names.";
    }
    case "DUPLICATE_COLUMNS": return "The CSV contains duplicate column names. Fix the header row and try again.";
    case "NOT_A_CSV": return "Choose a CSV file and try again.";
    case "MALFORMED_CSV": return "The CSV formatting is invalid. Check the file and try again.";
    case "TOO_MANY_ROWS": return "This file has more than 1,000 rows. Split it into smaller CSV files.";
    case "NO_CURRENT_SCHOOL_YEAR": return "Set a current school year before importing students.";
    case "IMPORT_CONFLICT": return "Data changed since the preview. Upload the file again to re-check it.";
    case "IMPORT_EXPIRED": return "This preview expired. Upload the file again.";
    case "ALREADY_COMMITTED": return "This import has already been committed.";
    case "FILE_TOO_LARGE": return "The file is larger than 2 MB. Choose a smaller CSV file.";
    case "UPLOAD_ERROR": return "The file could not be uploaded. Choose a CSV file and try again.";
    default: return fallback;
  }
}

function findStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const details = record.details && typeof record.details === "object"
    ? record.details as Record<string, unknown>
    : record;
  const candidate = details[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
}

export async function downloadApiFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "text/csv, application/json" } });
  if (!response.ok) {
    const responseText = await response.text();
    let payload: unknown;
    try { payload = responseText ? JSON.parse(responseText) as unknown : undefined; } catch { payload = undefined; }
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : response.statusText || "Download failed";
    const code = payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
      ? payload.code
      : undefined;
    throw new ApiError(response.status, friendlyApiMessage(code, message, payload), code, payload);
  }

  const disposition = response.headers.get("Content-Disposition");
  const filename = contentDispositionFilename(disposition) ?? fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function contentDispositionFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let candidate = plain;
  if (encoded) {
    try { candidate = decodeURIComponent(encoded); } catch { candidate = plain; }
  }
  return candidate ? candidate.replace(/[\\/]/g, "_") : null;
}
