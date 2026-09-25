import type { ColumnDef, DataGridFilterState } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';
import {
  isValuelessOp,
  normalizeFilterModel,
  type ColumnFilterModel,
  type DateFilterCondition,
  type NumberFilterCondition,
  type TextFilterCondition,
} from './filter-model';

type RowPredicate<T> = (row: T, rowIndex: number) => boolean;

/** Value a column filters on: `filterValueGetter` when set, else the cell value. */
export function getFilterValue<T>(row: T, column: ColumnDef<T>, rowIndex: number): unknown {
  return column.filterValueGetter
    ? column.filterValueGetter(row, rowIndex)
    : getCellValue(row, column, rowIndex);
}

/**
 * Searchable text for a raw value — dates as `yyyy-MM-dd`, arrays joined,
 * plain objects as `''` (use `valueFormatter` / `filterValueGetter` for those)
 * instead of `[object Object]`.
 */
export function filterText(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocalDateKey(value);
  }
  if (Array.isArray(value)) {
    return value.map(filterText).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return (value as object).toString === Object.prototype.toString ? '' : String(value);
  }
  return String(value);
}

/** Blank = null / undefined / whitespace-only string / empty array / invalid Date / NaN. */
export function isBlankFilterValue(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (typeof value === 'number') {
    return Number.isNaN(value);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime());
  }
  return Array.isArray(value) && value.length === 0;
}

function toFilterNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toFilterBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === 0) {
    return value === 1;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'yes' || v === '1') {
      return true;
    }
    if (v === 'false' || v === 'no' || v === '0') {
      return false;
    }
  }
  return null;
}

/** Set-filter key for one value: `null` for blanks, else its {@link filterText}. */
export function setFilterKey(value: unknown): string | null {
  return isBlankFilterValue(value) ? null : filterText(value);
}

/** Keys a value contributes to a set filter — array cells contribute each element. */
function setFilterKeys(value: unknown): (string | null)[] {
  if (Array.isArray(value)) {
    return value.length ? value.map(setFilterKey) : [null];
  }
  return [setFilterKey(value)];
}

type Evaluator = (value: unknown, texts: () => string[]) => boolean;

function combine(parts: Evaluator[], join: 'and' | 'or' | undefined): Evaluator {
  if (parts.length === 1) {
    return parts[0]!;
  }
  return join === 'or'
    ? (value, texts) => parts.some((p) => p(value, texts))
    : (value, texts) => parts.every((p) => p(value, texts));
}

function textEvaluator(c: TextFilterCondition): Evaluator {
  if (isValuelessOp(c.op)) {
    const blank = c.op === 'blank';
    return (value) => isBlankFilterValue(value) === blank;
  }
  const needle = (c.value ?? '').toLowerCase();
  const positive: Record<string, (text: string) => boolean> = {
    contains: (t) => t.includes(needle),
    notContains: (t) => t.includes(needle),
    equals: (t) => t === needle,
    notEqual: (t) => t === needle,
    startsWith: (t) => t.startsWith(needle),
    endsWith: (t) => t.endsWith(needle),
  };
  const test = positive[c.op]!;
  // Negations pass only when *no* candidate (raw or formatted) matches.
  return c.op === 'notContains' || c.op === 'notEqual'
    ? (_v, texts) => !texts().some(test)
    : (_v, texts) => texts().some(test);
}

function rangeEvaluator<V>(
  op: string,
  from: V | undefined,
  to: V | undefined,
  read: (value: unknown) => V | null,
): Evaluator {
  if (isValuelessOp(op)) {
    const blank = op === 'blank';
    return (value) => isBlankFilterValue(value) === blank;
  }
  const a = from as V;
  const b = to as V;
  const cmp: (v: V) => boolean = {
    equals: (v: V) => v === a,
    notEqual: (v: V) => v !== a,
    lessThan: (v: V) => v < a,
    before: (v: V) => v < a,
    lessThanOrEqual: (v: V) => v <= a,
    greaterThan: (v: V) => v > a,
    after: (v: V) => v > a,
    greaterThanOrEqual: (v: V) => v >= a,
    inRange: (v: V) => (a <= b ? v >= a && v <= b : v >= b && v <= a),
  }[op] ?? (() => true);
  // Blank / non-numeric values never match a comparison (incl. notEqual).
  return (value) => {
    const v = read(value);
    return v != null && cmp(v);
  };
}

function compileEvaluator(model: ColumnFilterModel): Evaluator | null {
  switch (model.kind) {
    case 'text':
      return combine(model.conditions.map(textEvaluator), model.join);
    case 'number':
      return combine(
        model.conditions.map((c: NumberFilterCondition) =>
          rangeEvaluator(c.op, c.value, c.valueTo, toFilterNumber),
        ),
        model.join,
      );
    case 'date':
      return combine(
        model.conditions.map((c: DateFilterCondition) =>
          rangeEvaluator(c.op, c.value, c.valueTo, toDateKey),
        ),
        model.join,
      );
    case 'set': {
      const included = new Set(model.values);
      return (value) => setFilterKeys(value).some((k) => included.has(k));
    }
    case 'boolean':
      return (value) => toFilterBoolean(value) === model.value;
    default:
      // `custom` needs `ColumnDef.filterPredicate`.
      return null;
  }
}

/** Compile one column's model to a row predicate (`null` = no-op / invalid model). */
export function compileColumnFilter<T>(
  column: ColumnDef<T>,
  rawModel: ColumnFilterModel | null | undefined,
): RowPredicate<T> | null {
  const model = normalizeFilterModel(rawModel);
  if (!model) {
    return null;
  }
  const predicate = column.filterPredicate;
  if (predicate) {
    return (row, rowIndex) => predicate(getFilterValue(row, column, rowIndex), row, model);
  }
  const evaluate = compileEvaluator(model);
  if (!evaluate) {
    return null;
  }
  const formatter = column.filterValueGetter ? undefined : column.valueFormatter;
  return (row, rowIndex) => {
    const value = getFilterValue(row, column, rowIndex);
    let texts: string[] | null = null;
    return evaluate(value, () => {
      if (!texts) {
        const raw = filterText(value).toLowerCase();
        const shown = formatter ? formatter(value, row, rowIndex).toLowerCase() : raw;
        texts = shown === raw ? [raw] : [raw, shown];
      }
      return texts;
    });
  };
}

export function filterRows<T>(
  rows: readonly T[],
  filters: DataGridFilterState,
  columnsById: Map<string, ColumnDef<T>>,
): T[] {
  const active: RowPredicate<T>[] = [];
  for (const [columnId, model] of Object.entries(filters)) {
    const column = columnsById.get(columnId);
    const predicate = column ? compileColumnFilter(column, model) : null;
    if (predicate) {
      active.push(predicate);
    }
  }
  if (!active.length) {
    // No-op stage: return the input unchanged (no copy); treat as read-only.
    return rows as T[];
  }
  return rows.filter((row, rowIndex) => active.every((p) => p(row, rowIndex)));
}

/** Lower-cased haystack for one row: raw + formatted (+ filter value) text of every column. */
function quickFilterHaystack<T>(row: T, columns: readonly ColumnDef<T>[], rowIndex: number): string {
  const parts: string[] = [];
  for (const column of columns) {
    const value = getCellValue(row, column, rowIndex);
    parts.push(filterText(value));
    if (column.valueFormatter) {
      parts.push(column.valueFormatter(value, row, rowIndex));
    }
    if (column.filterValueGetter) {
      parts.push(filterText(column.filterValueGetter(row, rowIndex)));
    }
  }
  // NUL separator: a word can never match across two cells.
  return parts.join('\u0000').toLowerCase();
}

/**
 * Quick filter — whitespace-separated words, case-insensitive; a row passes
 * when **every** word appears in some column (raw or formatted text).
 */
export function quickFilterRows<T>(
  rows: readonly T[],
  query: string,
  columns: readonly ColumnDef<T>[],
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return rows as T[];
  }
  return rows.filter((row, rowIndex) => {
    const haystack = quickFilterHaystack(row, columns, rowIndex);
    return words.every((word) => haystack.includes(word));
  });
}

export function applyExternalFilter<T>(
  rows: readonly T[],
  predicate: ((row: T) => boolean) | null | undefined,
): T[] {
  if (!predicate) {
    return rows as T[];
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
 * Normalize a date-ish value to a comparable **local** calendar `yyyy-MM-dd` key.
 *
 * - `Date` and epoch-millisecond numbers → the local day of that instant.
 * - ISO strings with a time **and** `Z` / `±hh:mm` offset are instants too →
 *   local day (so they agree with the same instant as a `Date`).
 * - `yyyy-MM-dd` and offset-less `yyyy-MM-ddThh:mm` keep their stated day.
 */
export function toDateKey(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatLocalDateKey(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? formatLocalDateKey(new Date(value)) : null;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    if (/[T\s]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
      const instant = new Date(text);
      if (!Number.isNaN(instant.getTime())) {
        return formatLocalDateKey(instant);
      }
    }
    return text.slice(0, 10);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDateKey(parsed);
  }
  return null;
}

/** One set-filter checkbox: `key` goes into `SetFilterModel.values`, `label` is shown. */
export interface SetFilterOption {
  key: string | null;
  label: string;
}

export interface SetFilterOptions {
  options: readonly SetFilterOption[];
  /** More distinct values exist than `setValueLimit`. */
  truncated: boolean;
}

export const EMPTY_SET_FILTER_OPTIONS: SetFilterOptions = { options: [], truncated: false };

const DEFAULT_SET_VALUE_LIMIT = 1000;

/**
 * Distinct set-filter values for a column — from `filterParams.setValues` or
 * the given rows. Numbers sort numerically, dates chronologically, text
 * naturally (`9` before `10`); blanks (`key: null`) come last.
 */
export function collectSetFilterValues<T>(
  rows: readonly T[],
  column: ColumnDef<T>,
  limit = column.filterParams?.setValueLimit ?? DEFAULT_SET_VALUE_LIMIT,
): SetFilterOptions {
  const seen = new Map<string | null, { label: string; sample: unknown }>();
  let truncated = false;
  const add = (value: unknown, label: () => string): boolean => {
    const key = setFilterKey(value);
    if (seen.has(key)) {
      return true;
    }
    if (seen.size >= limit) {
      truncated = true;
      return false;
    }
    seen.set(key, { label: key == null ? '' : label(), sample: value });
    return true;
  };
  const formatter = column.filterValueGetter ? undefined : column.valueFormatter;
  const labelOf = (value: unknown, row: T | undefined, rowIndex: number): string => {
    if (formatter) {
      try {
        return formatter(value, row as T, rowIndex);
      } catch {
        // Static `setValues` have no row — fall back to raw text.
      }
    }
    return filterText(value);
  };

  const fixed = column.filterParams?.setValues;
  if (fixed) {
    for (const value of fixed) {
      if (!add(value, () => labelOf(value, undefined, -1))) {
        break;
      }
    }
  } else {
    outer: for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]!;
      const value = getFilterValue(row, column, rowIndex);
      if (Array.isArray(value)) {
        for (const item of value.length ? value : [null]) {
          if (!add(item, () => filterText(item))) {
            break outer;
          }
        }
      } else if (!add(value, () => labelOf(value, row, rowIndex))) {
        break;
      }
    }
  }

  const entries = [...seen.entries()].filter(([key]) => key != null);
  const numeric = entries.length > 0 && entries.every(([, e]) => toFilterNumber(e.sample) != null);
  const dates = !numeric && entries.length > 0 && entries.every(([, e]) => e.sample instanceof Date);
  entries.sort(([ka, a], [kb, b]) => {
    if (numeric) {
      return toFilterNumber(a.sample)! - toFilterNumber(b.sample)!;
    }
    if (dates) {
      return ka! < kb! ? -1 : ka! > kb! ? 1 : 0;
    }
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  });
  const options: SetFilterOption[] = entries.map(([key, e]) => ({ key, label: e.label }));
  if (seen.has(null)) {
    options.push({ key: null, label: '' });
  }
  return { options, truncated };
}
