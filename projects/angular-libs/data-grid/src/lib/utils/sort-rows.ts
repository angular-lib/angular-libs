import type { ColumnDef, SortDirection, SortState } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';

export interface SortRowsOptions {
  /**
   * BCP-47 locale for string collation (e.g. `'nb'` so Å/Ø sort after Z).
   * Default: runtime default locale.
   */
  locale?: string;
}

const collators = new Map<string, Intl.Collator>();

/** Cached numeric, base-sensitivity collator per locale (construction is expensive). */
export function sortCollator(locale?: string): Intl.Collator {
  const key = locale ?? '';
  let collator = collators.get(key);
  if (!collator) {
    collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    collators.set(key, collator);
  }
  return collator;
}

/**
 * Normalized sort key: blank (`null` / `undefined` / `''` / `NaN` / invalid Date)
 * → `null`; Date → epoch ms; boolean → 0/1; everything else as-is.
 */
function toSortKey(value: unknown): unknown {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
}

/** Compare two normalized sort keys. Blanks sort first (ascending). */
function compareSortKeys(a: unknown, b: unknown, collator: Intl.Collator): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return -1;
  }
  if (b === null) {
    return 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return collator.compare(String(a), String(b));
}

/**
 * Stable multi-column sort. Cell values (incl. `valueGetter`) are read once per
 * row and column (decorate → sort → undecorate), not per comparison.
 */
export function sortRows<T>(
  rows: readonly T[],
  sorts: readonly SortState[],
  columnsById: Map<string, ColumnDef<T>>,
  options: SortRowsOptions = {},
): readonly T[] {
  const active: { column: ColumnDef<T>; sign: 1 | -1 }[] = [];
  for (const sort of sorts) {
    const column = columnsById.get(sort.columnId);
    if (column) {
      active.push({ column, sign: sort.direction === 'asc' ? 1 : -1 });
    }
  }
  if (!active.length) {
    // No-op stage: hand back the input unchanged (no copy).
    return rows;
  }

  const collator = sortCollator(options.locale);
  const decorated = rows.map((row, index) => ({
    row,
    index,
    keys: active.map(({ column }) => {
      const value = getCellValue(row, column, index);
      // Custom comparators get the raw value; built-in compare gets the normalized key.
      return column.comparator ? value : toSortKey(value);
    }),
  }));

  decorated.sort((left, right) => {
    for (let i = 0; i < active.length; i++) {
      const { column, sign } = active[i]!;
      const a = left.keys[i];
      const b = right.keys[i];
      const result = column.comparator
        ? column.comparator(a, b, left.row, right.row)
        : compareSortKeys(a, b, collator);
      if (result !== 0) {
        return sign * result;
      }
    }
    return left.index - right.index;
  });

  const out: T[] = new Array(decorated.length);
  for (let i = 0; i < decorated.length; i++) {
    out[i] = decorated[i]!.row;
  }
  return out;
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
