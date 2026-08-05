/**
 * Pure helpers for single-rectangle cell ranges (OVERVIEW §5).
 */

import type { CellRange } from '../components/data-grid/data-grid.types';
import type { FocusCell } from '../controllers/focus';

export interface NormalizedCellRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  columnIds: string[];
}

export function normalizeCellRange(
  range: CellRange,
  columnIds: readonly string[],
): NormalizedCellRange | null {
  const aCol = columnIds.indexOf(range.anchor.columnId);
  const bCol = columnIds.indexOf(range.active.columnId);
  if (aCol < 0 || bCol < 0) {
    return null;
  }
  const rowStart = Math.min(range.anchor.rowIndex, range.active.rowIndex);
  const rowEnd = Math.max(range.anchor.rowIndex, range.active.rowIndex);
  const colStart = Math.min(aCol, bCol);
  const colEnd = Math.max(aCol, bCol);
  return {
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    columnIds: columnIds.slice(colStart, colEnd + 1),
  };
}

export function cellInNormalizedRange(
  rowIndex: number,
  columnId: string,
  norm: NormalizedCellRange,
): boolean {
  if (rowIndex < norm.rowStart || rowIndex > norm.rowEnd) {
    return false;
  }
  const col = norm.columnIds.indexOf(columnId);
  return col >= 0;
}

export function moveFocusWithinGrid(
  from: FocusCell,
  dRow: number,
  dCol: number,
  columnIds: readonly string[],
  rowCount: number,
): FocusCell | null {
  if (!columnIds.length || rowCount <= 0) {
    return null;
  }
  const colIndex = Math.max(0, columnIds.indexOf(from.columnId));
  const nextCol = Math.max(0, Math.min(columnIds.length - 1, colIndex + dCol));
  const nextRow = Math.max(0, Math.min(rowCount - 1, from.rowIndex + dRow));
  return {
    rowIndex: nextRow,
    columnId: columnIds[nextCol]!,
    realm: 'body',
  };
}

export function singleCellRange(cell: FocusCell): CellRange {
  const point = { rowIndex: cell.rowIndex, columnId: cell.columnId };
  return { anchor: point, active: point };
}
