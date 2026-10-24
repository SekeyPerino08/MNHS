const SENSITIVE_KEY = /(password|token|secret|authorization|cookie)/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry));
  }
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSensitive(entry),
    ]),
  );
}
