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

interface ApiOptions extends Omit<RequestInit, "credentials"> {
  credentials?: RequestCredentials;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
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
    const message =
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
    throw new ApiError(response.status, message, code, payload);
  }

  return payload as T;
}
