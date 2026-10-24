import { parse as parseCsvSync } from "csv-parse/sync";
import type { Info } from "csv-parse";
import { AppError } from "../../../utils/AppError.js";
import type { ParsedCsv, ParsedRow, RowIssue } from "../import.types.js";

interface CsvRecord {
  record: string[];
  info: Info;
}

function invalidCsv(message: string, code: string): AppError {
  return new AppError(message, 400, code);
}

export function detectDelimiter(headerLine: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (let index = 0; index < headerLine.length; index += 1) {
    const character = headerLine[index];
    if (character === '"') {
      if (quoted && headerLine[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === ",") commas += 1;
    else if (!quoted && character === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(buffer: Buffer): ParsedCsv {
  if (buffer.length === 0) throw invalidCsv("The uploaded file is empty", "EMPTY_FILE");
  if (buffer.includes(0)) {
    throw invalidCsv("The file contains binary data and is not a CSV file", "NOT_A_CSV");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw invalidCsv("Invalid encoding. Save the file as CSV UTF-8 and upload it again.", "INVALID_ENCODING");
  }
  if (text.includes("\uFFFD")) {
    throw invalidCsv("Invalid encoding. Save the file as CSV UTF-8 and upload it again.", "INVALID_ENCODING");
  }
  text = text.replace(/^\uFEFF/, "");
  if (!text.trim()) throw invalidCsv("The uploaded file is empty", "EMPTY_FILE");

  const delimiter = detectDelimiter(text.split(/\r\n|\n|\r/, 1)[0] ?? "");
  let records: CsvRecord[];
  try {
    records = parseCsvSync(text, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      info: true,
      raw: true,
      relax_quotes: false,
      relax_column_count: false,
      max_record_size: 200_000,
    }) as unknown as CsvRecord[];
  } catch (error) {
    const line = typeof error === "object" && error !== null && "lines" in error
      ? Number(error.lines)
      : undefined;
    const lineText = line && Number.isFinite(line) ? ` near line ${line}` : "";
    throw invalidCsv(`Malformed CSV${lineText}. Check the quoting and column counts.`, "MALFORMED_CSV");
  }

  if (!records.length) throw invalidCsv("The uploaded file is empty", "EMPTY_FILE");
  const headers = records[0].record.map((header) => header.trim());
  if (headers.length > 30) {
    throw invalidCsv("CSV files may contain no more than 30 columns", "TOO_MANY_COLUMNS");
  }
  if (records.length - 1 > 1000) {
    throw invalidCsv("CSV files may contain no more than 1,000 data rows", "TOO_MANY_ROWS");
  }

  let previousEndLine = records[0].info.lines;
  let previousEmptyLines = records[0].info.empty_lines;
  const rows: ParsedRow[] = records.slice(1).map(({ record, info }) => {
    const rowNumber = previousEndLine + info.empty_lines - previousEmptyLines + 1;
    previousEndLine = info.lines;
    previousEmptyLines = info.empty_lines;
    const errors: RowIssue[] = [];
    record.forEach((cell, index) => {
      if (cell.length > 200) {
        errors.push({
          field: `column${index + 1}`,
          message: "Cell must be 200 characters or fewer",
        });
      }
    });
    return { rowNumber, original: record, errors };
  });
  return { delimiter, headers, rows };
}
