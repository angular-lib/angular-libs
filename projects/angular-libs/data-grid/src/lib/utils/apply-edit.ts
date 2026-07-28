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
