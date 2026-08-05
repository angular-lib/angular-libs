import type { ColumnDef, SortDirection, SortState } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';

function defaultCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return -1;
  }
  if (b == null) {
    return 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortRows<T>(
  rows: readonly T[],
  sorts: readonly SortState[],
  columnsById: Map<string, ColumnDef<T>>,
): T[] {
  if (!sorts.length) {
    return [...rows];
  }

  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const sort of sorts) {
        const column = columnsById.get(sort.columnId);
        if (!column) {
          continue;
        }
        const a = getCellValue(left.row, column, left.index);
        const b = getCellValue(right.row, column, right.index);
        const result = column.comparator
          ? column.comparator(a, b, left.row, right.row)
          : defaultCompare(a, b);
        if (result !== 0) {
          return sort.direction === 'asc' ? result : -result;
        }
      }
      return left.index - right.index;
    })
    .map((item) => item.row);
}

export function nextSortDirection(
  current: SortDirection | null,
  _multi: boolean,
): SortDirection | null {
  // Always cycle asc → desc → none (clear), including single-column sort.
  if (current === 'asc') {
    return 'desc';
  }
  if (current === 'desc') {
    return null;
  }
  return 'asc';
}
