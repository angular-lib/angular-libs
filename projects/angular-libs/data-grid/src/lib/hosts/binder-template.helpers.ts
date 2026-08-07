/**
 * Pure presentation helpers for binder templates / ColumnLayoutHost.
 * Keep Angular IO and coordinators on DataGrid; put geometry/ARIA/markers here.
 */

import { focusRealmOf, type FocusCell } from '../controllers/focus';
import { cellInNormalizedRange, normalizeCellRange } from '../utils/cell-range';
import { resolveCellClass } from '../utils/cell-value';
import type {
  CellRange,
  ColumnDef,
  ResolvedColumn,
  SortState,
} from '../components/data-grid/data-grid.types';

export function columnWidthOf<T>(
  column: ResolvedColumn<T>,
  resolvedWidths: Record<string, number>,
): number | null {
  return resolvedWidths[column.id] ?? column.width ?? column.minWidth;
}

export function pinnedLeftOffsetOf<T>(
  columnId: string,
  visibleColumns: readonly ResolvedColumn<T>[],
  resolvedWidths: Record<string, number>,
  showSelection: boolean,
  rowDragEnabled: boolean,
): number {
  let offset = (showSelection ? 40 : 0) + (rowDragEnabled ? 36 : 0);
  for (const col of visibleColumns) {
    if (col.pinned !== 'left') {
      continue;
    }
    if (col.id === columnId) {
      return offset;
    }
    offset += columnWidthOf(col, resolvedWidths) ?? col.minWidth;
  }
  return offset;
}

export function pinnedRightOffsetOf<T>(
  columnId: string,
  visibleColumns: readonly ResolvedColumn<T>[],
  resolvedWidths: Record<string, number>,
  fullRowEdit: boolean,
): number {
  let offset = fullRowEdit ? 132 : 0;
  const pinned = visibleColumns.filter((c) => c.pinned === 'right');
  for (let i = pinned.length - 1; i >= 0; i--) {
    const col = pinned[i]!;
    if (col.id === columnId) {
      return offset;
    }
    offset += columnWidthOf(col, resolvedWidths) ?? col.minWidth;
  }
  return offset;
}

export function ariaSortOf(
  columnId: string,
  sorts: readonly SortState[],
): 'ascending' | 'descending' | 'none' {
  const sort = sorts.find((s) => s.columnId === columnId);
  if (!sort) {
    return 'none';
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

export function sortMarkerOf(
  columnId: string,
  sorts: readonly SortState[],
): string | null {
  const index = sorts.findIndex((s) => s.columnId === columnId);
  if (index < 0) {
    return null;
  }
  const sort = sorts[index]!;
  const arrow = sort.direction === 'asc' ? '↑' : '↓';
  return sorts.length > 1 ? `${arrow}${index + 1}` : arrow;
}

export function ariaColIndexOf(
  visibleColIndex: number,
  rowDragEnabled: boolean,
  showSelection: boolean,
): number {
  let offset = 1;
  if (rowDragEnabled) {
    offset += 1;
  }
  if (showSelection) {
    offset += 1;
  }
  return offset + visibleColIndex;
}

export function headerRowCountOf(
  hasColumnGroups: boolean,
  floatingFilters: boolean,
): number {
  return 1 + (hasColumnGroups ? 1 : 0) + (floatingFilters ? 1 : 0);
}

export function ariaRowCountOf(
  headerRows: number,
  displayRowCount: number,
): number {
  return headerRows + displayRowCount;
}

export function ariaBodyRowIndexOf(
  headerRows: number,
  displayIndex: number,
): number {
  return headerRows + displayIndex + 1;
}

export function isCellFocusedOf(
  focus: FocusCell | null,
  rowIndex: number,
  columnId: string,
): boolean {
  return (
    !!focus &&
    focusRealmOf(focus) === 'body' &&
    focus.rowIndex === rowIndex &&
    focus.columnId === columnId
  );
}

export function isHeaderFocusedOf(focus: FocusCell | null, columnId: string): boolean {
  return !!focus && focusRealmOf(focus) === 'header' && focus.columnId === columnId;
}

export function isFloatingFilterFocusedOf(
  focus: FocusCell | null,
  columnId: string,
): boolean {
  return !!focus && focusRealmOf(focus) === 'floatingFilter' && focus.columnId === columnId;
}

export function cellAriaSelectedOf(
  rowSelected: boolean,
  range: CellRange | null | undefined,
  displayIndex: number,
  columnId: string,
  visibleColumnIds: readonly string[],
): boolean | null {
  if (rowSelected) {
    return true;
  }
  if (!range) {
    return null;
  }
  const norm = normalizeCellRange(range, visibleColumnIds);
  if (!norm || !cellInNormalizedRange(displayIndex, columnId, norm)) {
    return null;
  }
  return true;
}

export function mergeCellClass<T>(
  base: string,
  decorated: string,
): string {
  return [base, decorated].filter(Boolean).join(' ');
}

export function resolveBaseCellClass<T>(
  value: unknown,
  row: T,
  column: ColumnDef<T>,
  rowIndex: number,
): string {
  return resolveCellClass(value, row, column, rowIndex);
}
