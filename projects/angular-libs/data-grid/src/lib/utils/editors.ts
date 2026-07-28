import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';

export function resolveSelectValues<T>(
  column: ColumnDef<T>,
  row: T,
): string[] {
  const raw = column.cellEditorParams?.values;
  if (!raw) {
    return [];
  }
  const list = typeof raw === 'function' ? raw(row) : raw;
  return [...list].map(String);
}

export function isSelectEditor<T>(column: ColumnDef<T>): boolean {
  return column.cellEditor === 'select' || !!column.cellEditorParams?.values;
}

export function isCustomEditorComponent<T>(column: ColumnDef<T>): boolean {
  return typeof column.cellEditor === 'function';
}

export function isCustomRendererComponent<T>(column: ColumnDef<T>): boolean {
  return !!column.cellRenderer;
}

export function aggregateColumn<T>(
  rows: readonly T[],
  column: ColumnDef<T>,
): unknown {
  const fn = column.aggFunc;
  if (!fn) {
    return null;
  }
  const values = rows.map((row, index) => getCellValue(row, column, index));
  if (typeof fn === 'function') {
    return fn(values, rows);
  }
  const nums = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n) => !Number.isNaN(n));

  switch (fn) {
    case 'count':
      return rows.length;
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'min':
      return nums.length ? Math.min(...nums) : null;
    case 'max':
      return nums.length ? Math.max(...nums) : null;
    default:
      return null;
  }
}

export function formatAggregateValue<T = unknown>(
  value: unknown,
  column?: ColumnDef<T> | null,
): string {
  if (value == null) {
    return '';
  }
  if (column?.valueFormatter) {
    return column.valueFormatter(value, null as T, -1);
  }
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
