export function escapeCsvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeCsv(rows: readonly (readonly unknown[])[], delimiter = ","): string {
  return rows
    .map((row) => row.map(escapeCsvCell).join(delimiter))
    .join("\r\n");
}
