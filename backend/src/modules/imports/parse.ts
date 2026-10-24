import { parse as parseCsvSync } from "csv-parse/sync";
import type { Info } from "csv-parse";
import { AppError } from "../../utils/AppError.js";
import type { ParsedCsv } from "./import.types.js";

interface CsvRecord {
  record: string[];
  info: Info;
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];
    if (character === '"') {
      if (quoted && firstLine[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === ",") {
      commas += 1;
    } else if (!quoted && character === ";") {
      semicolons += 1;
    }
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(buffer: Buffer): ParsedCsv {
  if (buffer.includes(0)) {
    throw new AppError("The uploaded file contains binary data", 400, "INVALID_CSV");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw new AppError("The uploaded file is not valid UTF-8", 400, "INVALID_CSV");
  }

  const delimiter = detectDelimiter(text);
  let records: CsvRecord[];
  try {
    records = parseCsvSync(text, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      info: true,
      relax_column_count: true,
      max_record_size: 100_000,
    }) as unknown as CsvRecord[];
  } catch (error) {
    const line = typeof error === "object" && error !== null && "lines" in error
      ? Number(error.lines)
      : undefined;
    throw new AppError(
      line && Number.isFinite(line)
        ? `CSV parsing failed near row ${line}`
        : "CSV parsing failed; check quoting and delimiters",
      400,
      "INVALID_CSV",
    );
  }

  if (!records.length) {
    throw new AppError("The CSV file is empty", 400, "EMPTY_CSV");
  }
  const headers = records[0].record.map((header) => header.trim());
  if (headers.length > 30) {
    throw new AppError("CSV files may contain no more than 30 columns", 400, "TOO_MANY_COLUMNS");
  }
  if (records.length - 1 > 1000) {
    throw new AppError("CSV files may contain no more than 1,000 data rows", 400, "TOO_MANY_ROWS");
  }

  let previousEndLine = records[0].info.lines;
  let previousEmptyLines = records[0].info.empty_lines;
  const rows = records.slice(1).map(({ record, info }) => {
    const rowNumber = previousEndLine + (info.empty_lines - previousEmptyLines) + 1;
    previousEndLine = info.lines;
    previousEmptyLines = info.empty_lines;
    return { cells: record, rowNumber };
  });

  return { delimiter, headers, rows };
}
