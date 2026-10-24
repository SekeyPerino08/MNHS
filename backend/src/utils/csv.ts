export type CsvRow = Readonly<Record<string, unknown>> | readonly unknown[];

function cellAt(row: CsvRow, column: string, index: number): unknown {
  if (Array.isArray(row)) return (row as readonly unknown[])[index];
  return (row as Readonly<Record<string, unknown>>)[column];
}

export function escapeCsvCell(value: unknown): string {
  const isString = typeof value === "string";
  let text = value == null ? "" : String(value);
  if (isString && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeCsv(
  rows: readonly CsvRow[],
  columns: readonly string[],
  delimiter = ",",
): string {
  const body = [
    columns.map(escapeCsvCell).join(delimiter),
    ...rows.map((row) =>
      columns.map((column, index) => escapeCsvCell(cellAt(row, column, index))).join(delimiter),
    ),
  ].join("\r\n");
  return `\uFEFF${body}\r\n`;
}
