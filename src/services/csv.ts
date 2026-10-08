/**
 * Minimal RFC 4180 CSV reader/writer.
 *
 * - Writes UTF-8 with BOM + CRLF line endings so Excel / Google Sheets /
 *   LibreOffice open the files without any import wizard.
 * - Quotes any cell containing a comma, double quote or line break, and
 *   escapes inner double quotes by doubling them.
 * - The parser is a single character scan so quoted cells may contain
 *   commas, quotes and newlines safely.
 */

export const CSV_BOM = '\uFEFF';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

/** Serialize a header row plus data rows into CSV text (BOM + CRLF). */
export function toCsvText(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** Parse CSV text (with or without BOM, LF or CRLF) into a matrix of strings. */
export function parseCsvText(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushCell();
      i += 1;
      continue;
    }
    if (char === '\r') {
      pushRow();
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
  }
  if (inQuotes) throw new Error('Invalid CSV: an opening quote has no closing quote.');
  // Final cell/row (files normally end with a newline, which already flushed).
  if (cell !== '' || row.length > 0) {
    pushRow();
  }

  // Drop trailing blank rows produced by a terminating newline.
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === '') rows.pop();
    else break;
  }

  return rows;
}
