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
    if (typeof raw === 'number') {
      return raw;
    }
    const asNumber = parseNumericInput(String(raw));
    return asNumber == null ? raw : asNumber;
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

/**
 * Parse a pasted/filled number, including currency and thousands separators
 * (`$70,000`, `1.234,56`, `70 000`).
 */
function parseNumericInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const direct = Number(text);
  if (!Number.isNaN(direct)) {
    return direct;
  }
  let s = text.replace(/[\s\u00a0]/g, '').replace(/[^0-9,.\-eE+]/g, '');
  if (!s || s === '-' || s === '+' || s === '.') {
    return null;
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const frac = s.slice(lastComma + 1);
    s = frac.length === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const parsed = Number(s);
  return Number.isNaN(parsed) ? null : parsed;
}
