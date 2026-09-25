import { isDataDisplayRow, type DisplayRow } from './row-display';

export interface ParseClipboardOptions {
  /**
   * Field delimiter. Default `'\t'` (spreadsheet clipboard). There is no CSV
   * fallback — a single pasted column may legitimately contain commas
   * (`1,5`, `Smith, John`). Pass `','` only for explicit CSV input.
   */
  delimiter?: '\t' | ',';
}

/**
 * Parse clipboard text into a matrix of cell strings.
 *
 * RFC 4180-style state machine over the whole text (Excel / Sheets clipboard):
 * a field that *starts* with `"` is quoted and may contain the delimiter,
 * newlines, and `""` escapes. A quote elsewhere is literal. An unterminated
 * quote falls back to a literal `"`. `\r\n`, `\r`, and `\n` end a row; one
 * trailing row break is ignored.
 */
export function parseClipboardMatrix(
  text: string,
  options: ParseClipboardOptions = {},
): string[][] {
  const delimiter = options.delimiter ?? '\t';
  const rows: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let i = 0;
  /** Position whose opening quote must be read literally (unterminated quote). */
  let literalQuoteAt = -1;
  const n = text.length;

  const endField = (): void => {
    fields.push(current);
    current = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(fields);
    fields = [];
  };

  while (i < n) {
    const ch = text[i]!;
    if (ch === '"' && i !== literalQuoteAt && atFieldStart(text, i, delimiter)) {
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < n) {
        const q = text[j]!;
        if (q === '"') {
          if (text[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        value += q;
        j++;
      }
      if (!closed) {
        // Unterminated — re-read this field with the quote as a literal char.
        literalQuoteAt = i;
        continue;
      }
      // Chars after the closing quote (malformed) are kept literally until the delimiter.
      current = value;
      i = j;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      endRow();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    current += ch;
    i++;
  }
  // Last row, unless the text ended with a row break.
  if (current !== '' || fields.length) {
    endRow();
  }
  return rows;
}

function atFieldStart(text: string, i: number, delimiter: string): boolean {
  if (i === 0) {
    return true;
  }
  const prev = text[i - 1];
  return prev === delimiter || prev === '\n' || prev === '\r';
}

/**
 * Escape one cell for TSV clipboard output — inverse of {@link parseClipboardMatrix}.
 * Quotes cells containing the delimiter, a newline, or `"`.
 */
export function escapeClipboardCell(value: string, delimiter: '\t' | ',' = '\t'): string {
  if (value.includes(delimiter) || /[\n\r"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize a matrix as TSV clipboard text (round-trips through {@link parseClipboardMatrix}). */
export function serializeClipboardMatrix(matrix: readonly (readonly string[])[]): string {
  return matrix.map((row) => row.map((cell) => escapeClipboardCell(cell)).join('\t')).join('\n');
}

export interface PasteApplyResult<T> {
  rows: T[];
  /** Row ids aligned with `rows` (same index). */
  rowIds: Array<string | number>;
  changed: number;
}

/**
 * Repeat a clipboard/fill matrix to cover `rowCount` × `colCount`
 * (Excel / AG: a smaller copy tiles into a larger range).
 */
export function tileMatrix<V = string>(
  matrix: V[][],
  rowCount: number,
  colCount: number,
): V[][] {
  if (!matrix.length || rowCount <= 0 || colCount <= 0) {
    return [];
  }
  const out: V[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const src = matrix[r % matrix.length]!;
    const row: V[] = [];
    const srcLen = Math.max(1, src.length);
    for (let c = 0; c < colCount; c++) {
      row.push(src[c % srcLen] ?? ('' as V));
    }
    out.push(row);
  }
  return out;
}

/** One displayed data row a paste / fill writes into. */
export interface PasteTargetRow<T> {
  rowId: string | number;
  row: T;
  /** Index in processed rows (`DisplayRow.dataIndex`). */
  dataIndex: number;
}

/**
 * Walk **display** rows forward from `startDisplayIndex` collecting up to
 * `count` data rows — skips group headers and detail / plugin rows, and never
 * reaches rows hidden in collapsed groups (they are not displayed).
 */
export function collectPasteTargetRows<T>(
  displayRows: readonly DisplayRow<T>[],
  startDisplayIndex: number,
  count: number,
): PasteTargetRow<T>[] {
  const out: PasteTargetRow<T>[] = [];
  for (let i = Math.max(0, startDisplayIndex); i < displayRows.length && out.length < count; i++) {
    const item = displayRows[i];
    if (item && isDataDisplayRow(item)) {
      out.push({ rowId: item.rowId, row: item.row, dataIndex: item.dataIndex });
    }
  }
  return out;
}

/**
 * Apply a pasted/filled matrix: `matrix[r]` is written into the row whose id is
 * `targetRowIds[r]`, across `columnIds`. Rows are matched **by id** — display
 * order under grouping / tree differs from processed order.
 * Uses shallow field writes; hosts should prefer listening to `paste` and updating themselves.
 */
export function applyPasteMatrix<T, V = string>(
  rows: readonly T[],
  matrix: V[][],
  targetRowIds: readonly (string | number)[],
  columnIds: string[],
  options: {
    rowId: (row: T, index: number) => string | number;
    write: (row: T, columnId: string, value: V, rowIndex: number, rowId: string | number) => T;
  },
): PasteApplyResult<T> {
  const next = [...rows] as T[];
  const rowIds = next.map((row, i) => options.rowId(row, i));
  if (!matrix.length || !columnIds.length || !targetRowIds.length) {
    return { rows: next, rowIds, changed: 0 };
  }
  const indexById = new Map<string | number, number>();
  rowIds.forEach((id, i) => {
    if (!indexById.has(id)) {
      indexById.set(id, i);
    }
  });
  let changed = 0;
  const count = Math.min(matrix.length, targetRowIds.length);
  for (let r = 0; r < count; r++) {
    const targetId = targetRowIds[r]!;
    const rowIndex = indexById.get(targetId);
    if (rowIndex == null) {
      continue;
    }
    let row: T = next[rowIndex] as T;
    const cells = matrix[r]!;
    for (let c = 0; c < columnIds.length && c < cells.length; c++) {
      const updated = options.write(row, columnIds[c]!, cells[c] as V, rowIndex, targetId);
      if (updated !== row) {
        row = updated;
        changed++;
      }
    }
    next[rowIndex] = row;
  }
  return { rows: next, rowIds, changed };
}
