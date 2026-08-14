import type {
  CellEditEvent,
  ColumnDef,
  RowEditEvent,
  ValueSetterParams,
} from '../components/data-grid/data-grid.types';

export type { ValueSetterParams };

/**
 * Immutable cell update helper — preferred over mutating `event.row`.
 *
 * Uses `column.valueSetter` when provided; otherwise writes `column.field`.
 */
export function applyCellEdit<T>(
  rows: readonly T[],
  event: CellEditEvent<T>,
  rowId: (row: T, index: number) => string | number = (_row, index) => index,
): T[] {
  return rows.map((row, index) => {
    if (rowId(row, index) !== event.rowId) {
      return row;
    }
    return writeCellValue(row, event.column, event.columnId, event.previousValue, event.value);
  });
}

/** Replace one row after a full-row edit commit. */
export function applyRowEdit<T>(
  rows: readonly T[],
  event: RowEditEvent<T>,
  rowId: (row: T, index: number) => string | number = (_row, index) => index,
): T[] {
  return rows.map((row, index) => (rowId(row, index) === event.rowId ? event.value : row));
}

/**
 * Merge `suggested` rows into `source` by `rowId` (paste / fill write-back).
 * Source order is preserved; ids only in `suggested` are ignored.
 */
export function mergeRowsById<T>(
  source: readonly T[],
  suggested: readonly T[],
  rowId: (row: T, index: number) => string | number,
): T[] {
  if (!suggested.length) {
    return [...source];
  }
  const byId = new Map<string | number, T>();
  for (let i = 0; i < suggested.length; i++) {
    const row = suggested[i]!;
    byId.set(rowId(row, i), row);
  }
  return source.map((row, i) => {
    const id = rowId(row, i);
    return byId.has(id) ? byId.get(id)! : row;
  });
}

export function writeCellValue<T>(
  row: T,
  column: ColumnDef<T>,
  columnId: string,
  previousValue: unknown,
  value: unknown,
): T {
  if (column.valueSetter) {
    const next = column.valueSetter({
      row,
      column,
      columnId,
      previousValue,
      value,
    });
    return next === undefined ? row : next;
  }
  if (column.field) {
    return { ...(row as object), [column.field]: value } as T;
  }
  return row;
}
