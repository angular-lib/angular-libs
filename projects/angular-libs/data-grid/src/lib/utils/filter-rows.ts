import type { ColumnDef, DataGridFilterState } from '../components/data-grid/data-grid.types';
import { formatCellValue, getCellValue } from './cell-value';

export function filterRows<T>(
  rows: readonly T[],
  filters: DataGridFilterState,
  columnsById: Map<string, ColumnDef<T>>,
): T[] {
  const active = Object.entries(filters).filter(([, value]) => value.trim().length > 0);
  if (!active.length) {
    return [...rows];
  }

  return rows.filter((row, rowIndex) =>
    active.every(([columnId, query]) => {
      const column = columnsById.get(columnId);
      if (!column) {
        return true;
      }
      const raw = getCellValue(row, column, rowIndex);
      const filterType =
        column.filter === true
          ? column.type === 'number'
            ? 'number'
            : column.type === 'boolean'
              ? 'boolean'
              : column.type === 'date'
                ? 'date'
                : 'text'
          : column.filter;

      if (filterType === 'number') {
        const needle = Number(query);
        if (Number.isNaN(needle)) {
          return true;
        }
        const value = typeof raw === 'number' ? raw : Number(raw);
        return !Number.isNaN(value) && value === needle;
      }

      if (filterType === 'boolean') {
        const needle = query.trim().toLowerCase();
        const bool = Boolean(raw);
        if (needle === 'true' || needle === '1' || needle === 'yes') {
          return bool === true;
        }
        if (needle === 'false' || needle === '0' || needle === 'no') {
          return bool === false;
        }
        return true;
      }

      if (filterType === 'date') {
        const needle = toDateKey(query);
        if (!needle) {
          return true;
        }
        const valueKey = toDateKey(raw);
        return valueKey === needle;
      }

      if (filterType === 'set') {
        const selected = parseSetFilter(query);
        if (!selected.length) {
          return true;
        }
        const text = String(raw ?? '');
        return selected.includes(text);
      }

      return String(raw ?? '')
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    }),
  );
}

export function quickFilterRows<T>(
  rows: readonly T[],
  query: string,
  columns: readonly ColumnDef<T>[],
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }

  return rows.filter((row, rowIndex) =>
    columns.some((column) => {
      const value = getCellValue(row, column, rowIndex);
      const text = formatCellValue(value, row, column, rowIndex);
      return text.toLowerCase().includes(needle) || String(value ?? '').toLowerCase().includes(needle);
    }),
  );
}

export function applyExternalFilter<T>(
  rows: readonly T[],
  predicate: ((row: T) => boolean) | null | undefined,
): T[] {
  if (!predicate) {
    return [...rows];
  }
  return rows.filter(predicate);
}

/** Format a Date as local calendar yyyy-MM-dd (matches `<input type="date">`). */
export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize Date / ISO / yyyy-MM-dd to a comparable local calendar yyyy-MM-dd key.
 * Uses local Y-M-D for `Date` instances so midnight local dates don't shift via UTC.
 */
export function toDateKey(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDateKey(value);
  }
  const text = String(value).trim();
  // Calendar / ISO date prefix — take the stated day, don't re-parse through local TZ.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDateKey(parsed);
  }
  return null;
}

/** Set-filter values are stored as JSON string arrays in filter state. */
export function parseSetFilter(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v));
    }
  } catch {
    // fall through — treat as single value
  }
  return [trimmed];
}

export function serializeSetFilter(values: readonly string[]): string {
  return JSON.stringify([...values]);
}

/** Unique display values for a set-filter column (from source rows). */
export function collectSetFilterValues<T>(
  rows: readonly T[],
  column: ColumnDef<T>,
  limit = 200,
): string[] {
  const seen = new Set<string>();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const raw = getCellValue(rows[rowIndex]!, column, rowIndex);
    const text = String(raw ?? '');
    seen.add(text);
    if (seen.size >= limit) {
      break;
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
