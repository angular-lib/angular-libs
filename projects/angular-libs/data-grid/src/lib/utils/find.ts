import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { formatCellValue, getCellValue } from './cell-value';

export interface FindMatch {
  rowId: string | number;
  rowIndex: number;
  columnId: string;
}

export interface FindTextPart {
  text: string;
  match: boolean;
}

export function collectFindMatches<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  query: string,
  options: {
    caseSensitive?: boolean;
    rowId: (row: T, index: number) => string | number;
  },
): FindMatch[] {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const needle = options.caseSensitive ? q : q.toLowerCase();
  const matches: FindMatch[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const id = options.rowId(row, rowIndex);
    for (const column of columns) {
      const columnId = column.id ?? column.field ?? '';
      const value = getCellValue(row, column, rowIndex);
      const text = formatCellValue(value, row, column, rowIndex);
      const hay = options.caseSensitive ? text : text.toLowerCase();
      if (hay.includes(needle)) {
        matches.push({ rowId: id, rowIndex, columnId });
      }
    }
  }

  return matches;
}

/** Split display text into markable parts for the active find query. */
export function splitFindHighlight(
  text: string,
  query: string,
  caseSensitive = false,
): FindTextPart[] | null {
  const q = query.trim();
  if (!q || !text) {
    return null;
  }

  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  if (!hay.includes(needle)) {
    return null;
  }

  const parts: FindTextPart[] = [];
  let cursor = 0;
  let idx = hay.indexOf(needle, cursor);
  while (idx !== -1) {
    if (idx > cursor) {
      parts.push({ text: text.slice(cursor, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    cursor = idx + q.length;
    idx = hay.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  return parts;
}
