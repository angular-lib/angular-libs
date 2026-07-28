import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { formatCellValue, getCellValue } from './cell-value';

const CHAR_WIDTH = 7.2;
const CELL_PADDING = 24;

/** Estimate pixel width from header + sample cell text. */
export function estimateColumnWidth<T>(
  column: ColumnDef<T> & { id: string; header: string; minWidth: number },
  rows: readonly T[],
  sampleSize = 40,
): number {
  let maxChars = column.header.length;

  const limit = Math.min(rows.length, sampleSize);
  for (let i = 0; i < limit; i++) {
    const row = rows[i]!;
    const value = getCellValue(row, column, i);
    const text = formatCellValue(value, row, column, i);
    maxChars = Math.max(maxChars, text.length);
  }

  return Math.max(column.minWidth, Math.min(480, Math.ceil(maxChars * CHAR_WIDTH) + CELL_PADDING));
}
