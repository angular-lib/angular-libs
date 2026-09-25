/**
 * Shared parsing for cell edit + clipboard paste + fill.
 *
 * Strict by default: input that does not clearly mean a value of the column's
 * type is reported as an error instead of being written (no `"abc"` in a number
 * column, no `"2026-13-45"` rolling over into next year).
 */

import type {
  ColumnDef,
  ValueParserParams,
} from '../components/data-grid/data-grid.types';
import { defaultGridLocale, type DataGridLocale } from '../locale/default-locale';
import { writeCellValue } from './apply-edit';
import { getCellValue, isBooleanColumn, isDateColumn, serializeCellValue } from './cell-value';
import { formatLocalDateKey } from './filter-rows';

/** True when a pasted/edited string should be treated as blank. */
export function isBlankCellInput(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

export type CellParseResult = { ok: true; value: unknown } | { ok: false; error: string };

export type CellParseMessages = Pick<
  DataGridLocale,
  'invalidNumber' | 'invalidDate' | 'invalidBoolean' | 'invalidOption'
>;

export interface CellParseContext<T = unknown> {
  row?: T | null;
  columnId?: string;
  /** Current cell value — the parsed value keeps its shape (Date / ISO string / epoch ms). */
  previousValue?: unknown;
  /** BCP 47 tag for decimal / group separators and numeric date order. Default: runtime locale. */
  numberLocale?: string;
  messages?: Partial<CellParseMessages>;
  source?: ValueParserParams<T>['source'];
}

/** Parse context (locale + messages) derived from a grid locale. */
export function cellParseContextFromLocale(
  locale: Partial<DataGridLocale> | null | undefined,
): Pick<CellParseContext, 'numberLocale' | 'messages'> {
  return {
    numberLocale: locale?.numberLocale,
    messages: {
      invalidNumber: locale?.invalidNumber,
      invalidDate: locale?.invalidDate,
      invalidBoolean: locale?.invalidBoolean,
      invalidOption: locale?.invalidOption,
    },
  };
}

export function isNumberColumn<T>(column: ColumnDef<T>, previousValue?: unknown): boolean {
  return (
    column.type === 'number' ||
    column.filter === 'number' ||
    column.cellEditor === 'number' ||
    typeof previousValue === 'number'
  );
}

/** A paste / fill may write this column (editable and has a write path). */
export function isCellWritable<T>(column: ColumnDef<T> | null | undefined): boolean {
  return !!column?.editable && (!!column.field || !!column.valueSetter);
}

/**
 * Parse a draft / paste string into the column's value type.
 * `column.valueParser` wins; otherwise strict built-ins per column type:
 * - number — locale separators (`numberLocale`), optional currency affix; blank → `null`
 * - date — ISO `yyyy-mm-dd` or the locale's numeric order (`dd.mm.yyyy` for nb); blank → `null`
 * - boolean — `true/false/1/0/yes/no/…`
 * - select — must be one of `cellEditorParams.values`
 */
export function parseCellInput<T>(
  column: ColumnDef<T>,
  raw: unknown,
  ctx: CellParseContext<T> = {},
): CellParseResult {
  const messages = resolveMessages(ctx.messages);
  const previousValue = ctx.previousValue;

  if (column.valueParser) {
    const text = raw == null ? '' : typeof raw === 'string' ? raw : serializeCellValue(raw);
    const out = column.valueParser(text, {
      row: ctx.row ?? null,
      column,
      columnId: ctx.columnId ?? column.id ?? column.field ?? '',
      previousValue,
      numberLocale: ctx.numberLocale,
      source: ctx.source ?? 'edit',
    });
    return 'error' in out ? { ok: false, error: out.error } : { ok: true, value: out.value };
  }

  if (isBooleanColumn(column, previousValue)) {
    if (typeof raw === 'boolean') {
      return { ok: true, value: raw };
    }
    const text = String(raw ?? '').trim().toLowerCase();
    if (TRUE_WORDS.has(text)) {
      return { ok: true, value: true };
    }
    if (FALSE_WORDS.has(text)) {
      return { ok: true, value: false };
    }
    return { ok: false, error: messages.invalidBoolean };
  }

  if (isNumberColumn(column, previousValue)) {
    if (isBlankCellInput(raw)) {
      return { ok: true, value: null };
    }
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, error: messages.invalidNumber };
    }
    const parsed = parseLocaleNumber(String(raw), ctx.numberLocale);
    return parsed == null ? { ok: false, error: messages.invalidNumber } : { ok: true, value: parsed };
  }

  if (isDateColumn(column) || column.cellEditor === 'date') {
    if (isBlankCellInput(raw)) {
      return { ok: true, value: null };
    }
    const key =
      raw instanceof Date
        ? Number.isNaN(raw.getTime())
          ? null
          : formatLocalDateKey(raw)
        : parseDateKey(String(raw), ctx.numberLocale);
    if (!key) {
      return { ok: false, error: messages.invalidDate };
    }
    return { ok: true, value: dateKeyInShapeOf(key, previousValue) };
  }

  const options = selectOptions(column, ctx.row);
  if (options && !isBlankCellInput(raw) && !options.includes(String(raw))) {
    return { ok: false, error: messages.invalidOption };
  }

  return { ok: true, value: raw };
}

/**
 * Legacy helper — parsed value, or `previousValue` when the input is invalid
 * (never writes garbage). Prefer {@link parseCellInput} to see the error.
 */
export function coerceCellEditValue<T>(
  column: ColumnDef<T>,
  raw: unknown,
  previousValue?: unknown,
  ctx: Omit<CellParseContext<T>, 'previousValue'> = {},
): unknown {
  const parsed = parseCellInput(column, raw, { ...ctx, previousValue });
  return parsed.ok ? parsed.value : previousValue;
}

/** Same stored value (Date by time). */
export function sameCellValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
}

/**
 * Paste / fill write for one cell from text.
 * `null` = skipped (column not writable); `{ error }` = invalid input, not written.
 */
export function writeCellFromText<T>(
  row: T,
  column: ColumnDef<T> | null | undefined,
  columnId: string,
  text: string,
  rowIndex: number,
  ctx: Pick<CellParseContext<T>, 'numberLocale' | 'messages' | 'source'> = {},
): { row: T } | { error: string } | null {
  if (!column || !isCellWritable(column)) {
    return null;
  }
  const previous = getCellValue(row, column, rowIndex);
  const parsed = parseCellInput(column, text, { ...ctx, row, columnId, previousValue: previous });
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  if (sameCellValue(previous, parsed.value)) {
    return { row };
  }
  return { row: writeCellValue(row, column, columnId, previous, parsed.value) };
}

/** Editor draft text for a number (locale decimal separator, no grouping). */
export function formatNumberForEdit(value: unknown, numberLocale?: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value == null ? '' : String(value);
  }
  const text = String(value);
  const { decimal } = numberSeparators(numberLocale);
  return /e/i.test(text) || decimal === '.' ? text : text.replace('.', decimal);
}

// --- numbers -----------------------------------------------------------------

const separatorCache = new Map<string, { decimal: string; group: string }>();

/** Decimal / group separators for a BCP 47 locale (runtime default when omitted). */
export function numberSeparators(numberLocale?: string): { decimal: string; group: string } {
  const key = numberLocale ?? '';
  const cached = separatorCache.get(key);
  if (cached) {
    return cached;
  }
  let decimal = '.';
  let group = ',';
  try {
    const parts = new Intl.NumberFormat(numberLocale || undefined).formatToParts(1234567.5);
    decimal = parts.find((p) => p.type === 'decimal')?.value ?? decimal;
    group = parts.find((p) => p.type === 'group')?.value ?? group;
  } catch {
    /* invalid tag — keep defaults */
  }
  const out = { decimal, group };
  separatorCache.set(key, out);
  return out;
}

const CURRENCY_AFFIX = /^(?:[A-Za-z]{0,3}\p{Sc}[A-Za-z]{0,3}|[A-Z]{3}|kr\.?)$/u;

/**
 * Strict locale number parse. Accepts `[sign][currency]digits[groups][decimal digits][e±n][currency]`.
 * Rejects `abc`, `10-20`, `0x10`, `(100)`, `50%`, misplaced groups, and — when `.`
 * is only an alternate decimal (e.g. nb) — the ambiguous `1.500`.
 */
export function parseLocaleNumber(input: string, numberLocale?: string): number | null {
  let s = input.trim().replace(/−/g, '-');
  if (!s) {
    return null;
  }
  let sign = '';
  const takeSign = (): boolean => {
    if (s[0] === '-' || s[0] === '+') {
      if (sign) {
        return false;
      }
      sign = s[0];
      s = s.slice(1).trimStart();
    }
    return true;
  };
  if (!takeSign()) {
    return null;
  }
  const prefix = /^([^\d\s.,+-]+)\s*/u.exec(s);
  if (prefix) {
    if (!CURRENCY_AFFIX.test(prefix[1]!)) {
      return null;
    }
    s = s.slice(prefix[0].length);
    if (!takeSign()) {
      return null;
    }
  }
  const suffix = /\s*([^\d\s.,+-]+)$/u.exec(s);
  if (suffix && !/^[eE]$/.test(suffix[1]!)) {
    if (!CURRENCY_AFFIX.test(suffix[1]!)) {
      return null;
    }
    s = s.slice(0, s.length - suffix[0].length);
  }

  const { decimal, group } = numberSeparators(numberLocale);
  const groupClass = /^[\s  ]$/.test(group)
    ? '[ \\u00a0\\u202f]'
    : group === '’' || group === "'"
      ? "['’]"
      : escapeRegExp(group);
  const altDecimal = decimal !== '.' && group !== '.';
  const decimalClass = altDecimal ? `[${escapeRegExp(decimal)}.]` : escapeRegExp(decimal);
  const re = new RegExp(
    `^(?:(\\d{1,3}(?:${groupClass}\\d{3})+|\\d+)(?:(${decimalClass})(\\d*))?|(${decimalClass})(\\d+))(?:[eE]([+-]?\\d+))?$`,
  );
  const m = re.exec(s);
  if (!m) {
    return null;
  }
  const intPart = (m[1] ?? '0').replace(new RegExp(groupClass, 'g'), '');
  const sep = m[2] ?? m[4];
  const frac = m[3] ?? m[5] ?? '';
  // `1.500` with `.` only as an alternate decimal could be a thousands group — refuse.
  if (altDecimal && sep === '.' && m[1] && /^[1-9]\d{0,2}$/.test(m[1]) && frac.length === 3) {
    return null;
  }
  const canonical = `${sign === '-' ? '-' : ''}${intPart}${frac ? `.${frac}` : ''}${m[6] ? `e${m[6]}` : ''}`;
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

// --- dates -------------------------------------------------------------------

const dateOrderCache = new Map<string, Array<'day' | 'month' | 'year'>>();

function numericDateOrder(numberLocale?: string): Array<'day' | 'month' | 'year'> {
  const key = numberLocale ?? '';
  const cached = dateOrderCache.get(key);
  if (cached) {
    return cached;
  }
  let order: Array<'day' | 'month' | 'year'> = ['month', 'day', 'year'];
  try {
    const parts = new Intl.DateTimeFormat(numberLocale || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2001, 10, 22));
    const found = parts
      .map((p) => p.type)
      .filter((t): t is 'day' | 'month' | 'year' => t === 'day' || t === 'month' || t === 'year');
    if (found.length === 3) {
      order = found;
    }
  } catch {
    /* keep default */
  }
  dateOrderCache.set(key, order);
  return order;
}

/**
 * Strict calendar date → `yyyy-mm-dd`, or `null`.
 * Accepts ISO `yyyy-mm-dd` (optional time tail), `yyyy/mm/dd`, and the locale's
 * numeric order with a 4-digit year (`25.09.2026` nb, `9/25/2026` en-US).
 * Components are validated — no rollover.
 */
export function parseDateKey(input: string, numberLocale?: string): string | null {
  const text = input.trim();
  let y: number;
  let mo: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const m = /^(\d{1,4})\s*([./-])\s*(\d{1,2})\s*\2\s*(\d{1,4})\.?$/.exec(text);
    if (!m) {
      return null;
    }
    const a = m[1]!;
    const b = m[3]!;
    const c = m[4]!;
    if (a.length === 4) {
      y = Number(a);
      mo = Number(b);
      d = Number(c);
    } else {
      const order = numericDateOrder(numberLocale);
      const byType: Record<string, string> = {};
      [a, b, c].forEach((v, i) => (byType[order[i]!] = v));
      if (byType['year']?.length !== 4 || (byType['day']?.length ?? 0) > 2 || (byType['month']?.length ?? 0) > 2) {
        return null;
      }
      y = Number(byType['year']);
      mo = Number(byType['month']);
      d = Number(byType['day']);
    }
  }
  if (!(y >= 1 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo))) {
    return null;
  }
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Keep the stored shape: Date stays Date (time kept), ISO string stays string, epoch ms stays number. */
function dateKeyInShapeOf(key: string, previousValue: unknown): unknown {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  if (previousValue instanceof Date) {
    const t = Number.isNaN(previousValue.getTime()) ? new Date(0, 0, 1) : previousValue;
    const out = new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds());
    out.setFullYear(y);
    return out;
  }
  if (typeof previousValue === 'number') {
    const out = new Date(y, m - 1, d);
    out.setFullYear(y);
    return out.getTime();
  }
  if (typeof previousValue === 'string' && /^\d{4}-\d{2}-\d{2}./.test(previousValue)) {
    return key + previousValue.slice(10);
  }
  return key;
}

// --- booleans / select -------------------------------------------------------

const TRUE_WORDS = new Set(['true', '1', 'yes', 'y', 'on', 'x', '✓', '✔']);
const FALSE_WORDS = new Set(['false', '0', 'no', 'n', 'off', '']);

function selectOptions<T>(column: ColumnDef<T>, row: T | null | undefined): readonly string[] | null {
  const values = column.cellEditorParams?.values;
  if (!values) {
    return null;
  }
  if (typeof values === 'function') {
    return row == null ? null : values(row);
  }
  return values;
}

function resolveMessages(partial?: Partial<CellParseMessages>): CellParseMessages {
  return {
    invalidNumber: partial?.invalidNumber ?? defaultGridLocale.invalidNumber,
    invalidDate: partial?.invalidDate ?? defaultGridLocale.invalidDate,
    invalidBoolean: partial?.invalidBoolean ?? defaultGridLocale.invalidBoolean,
    invalidOption: partial?.invalidOption ?? defaultGridLocale.invalidOption,
  };
}
