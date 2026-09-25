/**
 * Typed column filter model — one JSON-serializable shape per filter kind.
 *
 * `DataGridFilterState` maps column id → {@link ColumnFilterModel}. The same
 * model drives client filtering, floating filters, the filters tool panel,
 * `getState()` / `setState()` and server-side `DataGridQuery.filters`.
 */
import type { ColumnDef, ColumnFilterType } from '../components/data-grid/data-grid.types';
import { formatNumberForEdit, parseLocaleNumber } from './coerce-cell-value';

export type TextFilterOp =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export type NumberFilterOp =
  | 'equals'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'inRange'
  | 'blank'
  | 'notBlank';

export type DateFilterOp = 'equals' | 'notEqual' | 'before' | 'after' | 'inRange' | 'blank' | 'notBlank';

/** Text match — case-insensitive; `value` is ignored by `blank` / `notBlank`. */
export interface TextFilterCondition {
  op: TextFilterOp;
  value?: string;
}

/** `inRange` is inclusive of both `value` and `valueTo`. */
export interface NumberFilterCondition {
  op: NumberFilterOp;
  value?: number;
  valueTo?: number;
}

/** Dates are local calendar days as ISO `yyyy-MM-dd` strings (serializable). `inRange` is inclusive. */
export interface DateFilterCondition {
  op: DateFilterOp;
  value?: string;
  valueTo?: string;
}

export type FilterJoin = 'and' | 'or';

export interface TextFilterModel {
  kind: 'text';
  conditions: TextFilterCondition[];
  /** How conditions combine. Default `'and'`. */
  join?: FilterJoin;
}

export interface NumberFilterModel {
  kind: 'number';
  conditions: NumberFilterCondition[];
  join?: FilterJoin;
}

export interface DateFilterModel {
  kind: 'date';
  conditions: DateFilterCondition[];
  join?: FilterJoin;
}

/**
 * Include-list of set keys (see `setFilterKey`); `null` = blanks.
 * No model = everything included; `values: []` = nothing included.
 */
export interface SetFilterModel {
  kind: 'set';
  values: (string | null)[];
}

export interface BooleanFilterModel {
  kind: 'boolean';
  value: boolean;
}

/** Opaque model evaluated by `ColumnDef.filterPredicate` (no built-in UI). */
export interface CustomFilterModel {
  kind: 'custom';
  value: unknown;
}

export type ColumnFilterModel =
  | TextFilterModel
  | NumberFilterModel
  | DateFilterModel
  | SetFilterModel
  | BooleanFilterModel
  | CustomFilterModel;

export type ColumnFilterKind = ColumnFilterModel['kind'];

export type ConditionFilterModel = TextFilterModel | NumberFilterModel | DateFilterModel;

/** Per-column filter options (`ColumnDef.filterParams`). */
export interface ColumnFilterParams {
  /**
   * Fixed set-filter values (raw cell values) instead of scanning rows —
   * use with server-side data where the client only holds one page.
   */
  setValues?: readonly unknown[];
  /** Max distinct set-filter values collected from rows. Default 1000. */
  setValueLimit?: number;
}

export const TEXT_FILTER_OPS: readonly TextFilterOp[] = [
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'blank',
  'notBlank',
];
export const NUMBER_FILTER_OPS: readonly NumberFilterOp[] = [
  'equals',
  'notEqual',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'inRange',
  'blank',
  'notBlank',
];
export const DATE_FILTER_OPS: readonly DateFilterOp[] = [
  'equals',
  'notEqual',
  'before',
  'after',
  'inRange',
  'blank',
  'notBlank',
];

/** Filter kind a column's UI and `filter: true` inference use — one source of truth. */
export function resolveFilterKind<T>(
  column: Pick<ColumnDef<T>, 'filter' | 'type'>,
): ColumnFilterKind | null {
  const filter: ColumnFilterType | undefined = column.filter;
  if (!filter) {
    return null;
  }
  if (filter !== true) {
    return filter;
  }
  switch (column.type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

/** Ops that need no operand. */
export function isValuelessOp(op: string): op is 'blank' | 'notBlank' {
  return op === 'blank' || op === 'notBlank';
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Real calendar day in `yyyy-MM-dd` form. */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validJoin(join: unknown): boolean {
  return join === undefined || join === 'and' || join === 'or';
}

function validCondition(kind: 'text' | 'number' | 'date', raw: unknown): boolean {
  if (!isRecord(raw) || typeof raw['op'] !== 'string') {
    return false;
  }
  const op = raw['op'];
  const value = raw['value'];
  const valueTo = raw['valueTo'];
  if (kind === 'text') {
    return (
      (TEXT_FILTER_OPS as readonly string[]).includes(op) &&
      (isValuelessOp(op) || typeof value === 'string')
    );
  }
  const ops: readonly string[] = kind === 'number' ? NUMBER_FILTER_OPS : DATE_FILTER_OPS;
  const check = kind === 'number' ? isFiniteNumber : isDateKey;
  if (!ops.includes(op)) {
    return false;
  }
  if (isValuelessOp(op)) {
    return true;
  }
  return check(value) && (op !== 'inRange' || check(valueTo));
}

/**
 * Structural guard for one column filter model (persisted state, URL, API input).
 * Rejects unknown kinds / ops, wrong value types, and empty condition lists.
 */
export function isValidColumnFilterModel(value: unknown): value is ColumnFilterModel {
  if (!isRecord(value)) {
    return false;
  }
  switch (value['kind']) {
    case 'text':
    case 'number':
    case 'date': {
      const conditions = value['conditions'];
      const kind = value['kind'];
      return (
        Array.isArray(conditions) &&
        conditions.length > 0 &&
        conditions.every((c) => validCondition(kind, c)) &&
        validJoin(value['join'])
      );
    }
    case 'set': {
      const values = value['values'];
      return Array.isArray(values) && values.every((v) => v === null || typeof v === 'string');
    }
    case 'boolean':
      return typeof value['value'] === 'boolean';
    case 'custom':
      return 'value' in value;
    default:
      return false;
  }
}

/** Keep only valid entries of a raw filter map (drops e.g. legacy string filters). */
export function sanitizeFilterState(raw: unknown): Record<string, ColumnFilterModel> {
  if (!isRecord(raw)) {
    return {};
  }
  const out: Record<string, ColumnFilterModel> = {};
  for (const [id, model] of Object.entries(raw)) {
    const normalized = isValidColumnFilterModel(model) ? normalizeFilterModel(model) : null;
    if (normalized) {
      out[id] = normalized;
    }
  }
  return out;
}

/**
 * Drop incomplete conditions (empty text, missing operands). Returns `null`
 * when nothing active remains — the grid never stores no-op models.
 */
export function normalizeFilterModel(
  model: ColumnFilterModel | null | undefined,
): ColumnFilterModel | null {
  if (!model || !isRecord(model)) {
    return null;
  }
  if (model.kind === 'text' || model.kind === 'number' || model.kind === 'date') {
    if (!Array.isArray(model.conditions)) {
      return null;
    }
    const valid = (model.conditions as unknown[]).filter((c) => validCondition(model.kind, c));
    const conditions =
      model.kind === 'text'
        ? (valid as TextFilterCondition[])
            .map((c) => (isValuelessOp(c.op) ? { op: c.op } : { op: c.op, value: c.value!.trim() }))
            .filter((c) => isValuelessOp(c.op) || c.value!.length > 0)
        : valid;
    if (!conditions.length) {
      return null;
    }
    const join = model.join === 'or' && conditions.length > 1 ? { join: 'or' as const } : {};
    return { kind: model.kind, conditions, ...join } as ColumnFilterModel;
  }
  return isValidColumnFilterModel(model) ? model : null;
}

/** Structural equality for (JSON-shaped) filter models. */
export function sameFilterModel(
  a: ColumnFilterModel | null | undefined,
  b: ColumnFilterModel | null | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// --- number shorthand ------------------------------------------------------

export type NumberInputParse =
  | { ok: true; condition: NumberFilterCondition | null }
  | { ok: false };

const SHORTHAND_OPS: ReadonlyArray<[string, NumberFilterOp]> = [
  ['>=', 'greaterThanOrEqual'],
  ['≥', 'greaterThanOrEqual'],
  ['<=', 'lessThanOrEqual'],
  ['≤', 'lessThanOrEqual'],
  ['<>', 'notEqual'],
  ['!=', 'notEqual'],
  ['≠', 'notEqual'],
  ['>', 'greaterThan'],
  ['<', 'lessThan'],
  ['=', 'equals'],
];

function splitRange(text: string): [string, string] | null {
  for (const sep of ['..', '–', '—']) {
    const at = text.indexOf(sep);
    if (at > 0) {
      return [text.slice(0, at), text.slice(at + sep.length)];
    }
  }
  // `-` is also a sign: only split at a hyphen that follows a digit.
  for (let i = 1; i < text.length; i++) {
    if (text[i] === '-' && /\d$/.test(text.slice(0, i).trimEnd())) {
      return [text.slice(0, i), text.slice(i + 1)];
    }
  }
  return null;
}

/** True when the text uses operator / range shorthand (it overrides the op dropdown). */
export function hasNumberShorthand(text: string): boolean {
  const trimmed = text.trim();
  return SHORTHAND_OPS.some(([prefix]) => trimmed.startsWith(prefix)) || !!splitRange(trimmed);
}

/**
 * Parse number-filter text. Accepts a plain number (uses `fallbackOp`),
 * shorthand `>100`, `>=5`, `<=5`, `!=3`, `=7`, and ranges `10-20` / `10..20`.
 * Empty text → `{ ok: true, condition: null }`; unparseable → `{ ok: false }`.
 */
export function parseNumberFilterInput(
  text: string,
  fallbackOp: NumberFilterOp = 'equals',
  numberLocale?: string,
): NumberInputParse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, condition: null };
  }
  const num = (s: string): number | null => parseLocaleNumber(s, numberLocale);
  for (const [prefix, op] of SHORTHAND_OPS) {
    if (trimmed.startsWith(prefix)) {
      const value = num(trimmed.slice(prefix.length));
      return value == null ? { ok: false } : { ok: true, condition: { op, value } };
    }
  }
  const range = splitRange(trimmed);
  if (range) {
    const from = num(range[0]);
    const to = num(range[1]);
    if (from != null && to != null) {
      return {
        ok: true,
        condition: { op: 'inRange', value: Math.min(from, to), valueTo: Math.max(from, to) },
      };
    }
  }
  const value = num(trimmed);
  if (value == null) {
    return { ok: false };
  }
  const op = fallbackOp === 'inRange' || isValuelessOp(fallbackOp) ? 'equals' : fallbackOp;
  return { ok: true, condition: { op, value } };
}

/** Round-trippable text for one number condition (inverse of {@link parseNumberFilterInput}). */
export function formatNumberFilterInput(
  condition: NumberFilterCondition,
  numberLocale?: string,
): string {
  const fmt = (n: number | undefined) => formatNumberForEdit(n, numberLocale);
  if (isValuelessOp(condition.op)) {
    return '';
  }
  if (condition.op === 'inRange') {
    return `${fmt(condition.value)}..${fmt(condition.valueTo)}`;
  }
  return fmt(condition.value);
}

/** Compact operator glyphs for floating filters (full labels live in the locale). */
export const FILTER_OP_SYMBOLS: Readonly<Record<string, string>> = {
  contains: '~',
  notContains: '!~',
  equals: '=',
  notEqual: '≠',
  startsWith: 'a…',
  endsWith: '…a',
  lessThan: '<',
  lessThanOrEqual: '≤',
  greaterThan: '>',
  greaterThanOrEqual: '≥',
  before: '<',
  after: '>',
  inRange: '↔',
  blank: '∅',
  notBlank: '!∅',
};
