/**
 * Shared coercion for cell edit + clipboard paste.
 */

import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { isBooleanColumn, isDateColumn } from './cell-value';
import { toDateKey } from './filter-rows';

/** True when a pasted/edited string should be treated as blank. */
export function isBlankCellInput(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Coerce a draft / paste string into the column's value type.
 * Blank number inputs become `null` (not `0`). Date drafts become `Date`.
 */
export function coerceCellEditValue<T>(
  column: ColumnDef<T>,
  raw: unknown,
  previousValue?: unknown,
): unknown {
  if (isBooleanColumn(column, previousValue)) {
    if (typeof raw === 'boolean') {
      return raw;
    }
    const text = String(raw ?? '')
      .trim()
      .toLowerCase();
    return text === 'true' || text === '1' || text === 'yes';
  }

  const isNumber =
    column.type === 'number' ||
    column.filter === 'number' ||
    column.cellEditor === 'number' ||
    typeof previousValue === 'number';

  if (isNumber) {
    if (isBlankCellInput(raw)) {
      return null;
    }
    const asNumber = Number(raw);
    return Number.isNaN(asNumber) ? raw : asNumber;
  }

  if (isDateColumn(column) || column.cellEditor === 'date') {
    if (isBlankCellInput(raw)) {
      return null;
    }
    const key = toDateKey(raw);
    if (!key) {
      return raw;
    }
    // Preserve Date when the previous value was a Date; otherwise keep yyyy-MM-dd.
    // Local midnight — matches `<input type="date">` and avoids UTC day-shift.
    if (previousValue instanceof Date || column.type === 'date') {
      const [y, m, d] = key.split('-').map(Number);
      if (!y || !m || !d) {
        return raw;
      }
      const parsed = new Date(y, m - 1, d);
      return Number.isNaN(parsed.getTime()) ? raw : parsed;
    }
    return key;
  }

  return raw;
}
