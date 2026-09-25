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

/**
 * Built-in column aggregate.
 *
 * Blank values (`null` / `undefined` / `''`) are skipped by every built-in:
 * - `count` — number of non-blank values (SQL `COUNT(column)`)
 * - `sum` / `avg` / `min` / `max` — over finite numbers only (numbers or numeric
 *   strings; `NaN` / `Infinity` / booleans / objects are ignored). `avg` / `min` /
 *   `max` return `null` when no numeric value exists; `sum` returns `0`.
 */
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

  if (fn === 'count') {
    let count = 0;
    for (const v of values) {
      if (v != null && v !== '') {
        count++;
      }
    }
    return count;
  }

  // Loop (no `Math.min(...nums)` spread — that overflows the stack on large sets).
  let n = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const num = toAggregateNumber(v);
    if (num === null) {
      continue;
    }
    n++;
    sum += num;
    if (num < min) {
      min = num;
    }
    if (num > max) {
      max = num;
    }
  }

  switch (fn) {
    case 'sum':
      return sum;
    case 'avg':
      return n ? sum / n : null;
    case 'min':
      return n ? min : null;
    case 'max':
      return n ? max : null;
    default:
      return null;
  }
}

/** Finite number for aggregation, or `null` for blank / non-numeric values. */
function toAggregateNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return null;
    }
    const num = Number(text);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function formatAggregateValue<T = unknown>(
  value: unknown,
  column?: ColumnDef<T> | null,
): string {
  if (value == null) {
    return '';
  }
  // Aggregates have no row: `valueFormatter` gets `row: undefined`, `rowIndex: -1`.
  // Formatters that dereference `row` throw → fall back to default formatting.
  // `count` is a tally, not a column value — never run the column formatter on it.
  if (column?.valueFormatter && column.aggFunc !== 'count') {
    try {
      return column.valueFormatter(value, undefined as T, -1);
    } catch {
      // fall through
    }
  }
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
